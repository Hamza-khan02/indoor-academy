// The booking engine: creating, approving, cancelling, rescheduling and moving bookings through
// their statuses. Everything that changes a booking happens here, inside `rentalTx`, so that
// availability is always checked on the server in the same transaction that reserves the slot.
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { addDays } from '../dates';
import { FormError } from '../form';
import { whatsappNumber } from '../messages';
import { BOOKING_STATUS, RELEASING, UPCOMING, canTransition } from './constants';
import { type Actor, type Tx, SYSTEM, advanceDue, audit, rentalTx } from './core';
import { type EquipmentWindow, equipmentFree } from './equipment';
import { notifyBooking } from './notify';
import { type PriceLine, type PromoConfig, type Quote, cancellationCharge, quote } from './pricing';
import { type RentalSettings, gatewayConfig, getRentalSettings } from './settings';
import { blocksOf, hoursUntil, instantOf, nowIST, overlaps, rentalDays } from './time';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RENTAL_DAYS = 30;
/** A customer cannot sit on more than this many unpaid holds at once. */
const MAX_OPEN_HOLDS = 3;

export type BookingWho =
  | { kind: 'CUSTOMER'; customerId: string }
  | { kind: 'FAMILY'; familyLoginId: string; studentId: string }
  | { kind: 'WALK_IN'; name: string; phone: string; email?: string | null; studentId?: string | null };

export type BookingInput = {
  facilityId: string;
  packageId?: string | null;
  date: string;
  /** Start time and number of slots. Not used for whole-day facilities or equipment-only rentals. */
  startMin?: number | null;
  slots?: number | null;
  /** Staff may choose the exact unit; customers get the first free one. */
  resourceId?: string | null;
  equipment?: { itemId: string; qty: number }[];
  /** Equipment-only rentals: the day the items come back. */
  returnDate?: string | null;
  players?: number | null;
  notes?: string | null;
  promoCode?: string | null;
  paymentMethod: 'ONLINE' | 'PAY_AT_VENUE';
  who: BookingWho;
};

type Db = Tx | typeof db;
const label = (status: string) => BOOKING_STATUS[status]?.label ?? status;
const validDate = (iso: unknown): iso is string => typeof iso === 'string' && DATE_RE.test(iso) && !Number.isNaN(Date.parse(iso));

// ---------------------------------------------------------------------------
// Availability (server side)
// ---------------------------------------------------------------------------

type FacilityUnits = { id: string; resources: { id: string; name: string; status: string }[] };

/** The first unit of a facility that is free for the whole time range, or null. Call inside a transaction. */
async function findFreeResource(
  tx: Db,
  facility: FacilityUnits,
  date: string,
  startMin: number,
  endMin: number,
  opts: { onlyId?: string | null; preferId?: string | null; excludeBookingId?: string } = {},
) {
  const candidates = facility.resources
    .filter((r) => r.status === 'ACTIVE' && (!opts.onlyId || r.id === opts.onlyId))
    .sort((a, b) => (a.id === opts.preferId ? -1 : b.id === opts.preferId ? 1 : a.name.localeCompare(b.name, undefined, { numeric: true })));
  if (candidates.length === 0) return null;
  const [taken, blockouts] = await Promise.all([
    tx.resourceSlot.findMany({
      where: {
        resourceId: { in: candidates.map((r) => r.id) }, date, block: { in: blocksOf(startMin, endMin) },
        ...(opts.excludeBookingId ? { bookingId: { not: opts.excludeBookingId } } : {}),
      },
      select: { resourceId: true },
      distinct: ['resourceId'],
    }),
    tx.facilityBlockout.findMany({ where: { facilityId: facility.id, fromDate: { lte: date }, toDate: { gte: date } } }),
  ]);
  const busy = new Set(taken.map((t) => t.resourceId));
  for (const b of blockouts) {
    if (b.startMin !== null && b.endMin !== null && !overlaps(b.startMin, b.endMin, startMin, endMin)) continue;
    if (!b.resourceId) return null; // the whole facility is blocked
    busy.add(b.resourceId);
  }
  return candidates.find((r) => !busy.has(r.id)) ?? null;
}

/** Releases unpaid holds whose time has run out. Runs at the start of every booking transaction. */
export async function releaseExpired(tx: Tx, now = new Date()) {
  const expired = await tx.rentalBooking.findMany({
    where: { status: { in: ['PENDING', 'PAYMENT_PENDING'] }, expiresAt: { lt: now } },
    select: { id: true },
  });
  for (const b of expired) await applyStatus(tx, b.id, 'EXPIRED', SYSTEM, { note: 'The hold ran out before payment or approval.' });
  return expired.map((b) => b.id);
}

// ---------------------------------------------------------------------------
// Pieces shared by "work out the price" and "create the booking"
// ---------------------------------------------------------------------------

export async function findPromo(tx: Db, code: string | null | undefined, facilityId: string) {
  const wanted = code?.trim().toUpperCase();
  if (!wanted) return null;
  const promo = await tx.rentalPromo.findUnique({ where: { code: wanted } });
  const today = nowIST().date;
  const ok = promo && promo.active
    && (!promo.validFrom || promo.validFrom <= today) && (!promo.validTo || promo.validTo >= today)
    && (promo.maxUses === null || promo.usedCount < promo.maxUses)
    && (!promo.facilityId || promo.facilityId === facilityId);
  if (!ok) throw new FormError('This promo code is not valid for this booking.');
  return { id: promo.id, code: promo.code, percentOff: promo.percentOff, amountOff: promo.amountOff, minAmount: promo.minAmount };
}

async function resolveEquipment(tx: Db, requested: BookingInput['equipment'], window: EquipmentWindow, excludeBookingId?: string) {
  const wanted = new Map<string, number>();
  for (const line of requested ?? []) {
    if (!line || typeof line.itemId !== 'string') continue;
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 0 || qty > 100) throw new FormError('Enter a whole number of items.');
    if (qty > 0) wanted.set(line.itemId, (wanted.get(line.itemId) ?? 0) + qty);
  }
  if (wanted.size === 0) return [];
  const ids = [...wanted.keys()];
  const [items, free] = await Promise.all([tx.equipmentItem.findMany({ where: { id: { in: ids } } }), equipmentFree(tx, ids, window, excludeBookingId)]);
  return ids.map((id) => {
    const item = items.find((i) => i.id === id);
    const qty = wanted.get(id)!;
    if (!item || !item.active) throw new FormError('One of the chosen items is no longer rented out.');
    const available = free.get(id) ?? 0;
    if (available < qty) throw new FormError(available === 0 ? `${item.name} is not available at that time.` : `Only ${available} × ${item.name} available at that time.`);
    return { item, qty };
  });
}

type Prepared = Awaited<ReturnType<typeof prepare>>;

/**
 * Validates a booking request against the facility's saved rules and prices and returns the
 * resolved time window, equipment and price. Does not reserve anything.
 */
async function prepare(tx: Db, input: BookingInput, ctx: { staff: boolean; isStudent: boolean; settings: RentalSettings; now: Date; excludeBookingId?: string; skipPromo?: boolean }) {
  const { staff, settings, now } = ctx;
  const facility = await tx.rentalFacility.findUnique({ where: { id: String(input.facilityId) }, include: { pricing: true, resources: true, packages: true } });
  if (!facility) throw new FormError('This facility no longer exists.');
  if (facility.status !== 'ACTIVE') throw new FormError(facility.status === 'MAINTENANCE' ? `${facility.name} is under maintenance.` : `${facility.name} is not open for booking.`);
  if (!facility.pricing) throw new FormError(`Prices for ${facility.name} have not been set yet.`);
  const equipmentOnly = facility.category === 'EQUIPMENT';
  const wholeDay = facility.pricing.unit === 'PER_DAY';

  if (!validDate(input.date)) throw new FormError('Choose a date.');
  const today = nowIST(now);
  if (input.date < today.date) throw new FormError('That date has passed.');
  if (!staff && input.date > addDays(today.date, settings.bookingWindowDays)) throw new FormError(`Bookings open ${settings.bookingWindowDays} days ahead.`);

  let startMin = facility.openTime;
  let endMin = facility.closeTime;
  let returnDate: string | null = null;
  if (equipmentOnly) {
    returnDate = input.returnDate || input.date;
    if (!validDate(returnDate) || returnDate < input.date) throw new FormError('The return date cannot be before the pick-up date.');
    if (rentalDays(input.date, returnDate) > MAX_RENTAL_DAYS) throw new FormError(`Equipment can be rented for up to ${MAX_RENTAL_DAYS} days.`);
  } else if (!wholeDay) {
    const start = Number(input.startMin);
    const slots = Number(input.slots ?? 1);
    if (!Number.isInteger(start) || start < facility.openTime || (start - facility.openTime) % facility.slotMinutes !== 0) throw new FormError('Choose a start time.');
    if (!Number.isInteger(slots) || slots < 1 || slots > facility.maxSlots) throw new FormError(`Choose between 1 and ${facility.maxSlots} slots.`);
    startMin = start;
    endMin = start + slots * facility.slotMinutes;
    if (endMin > facility.closeTime) throw new FormError('That goes past closing time. Choose an earlier start or a shorter booking.');
  }
  // Customers cannot book something that has started or is about to; staff can enter today's bookings late.
  const tooLate = equipmentOnly || wholeDay
    ? instantOf(input.date, endMin).getTime() <= now.getTime()
    : instantOf(input.date, startMin).getTime() < now.getTime() + (staff ? -24 * 3_600_000 : settings.minLeadMinutes * 60_000);
  if (tooLate) throw new FormError(staff ? 'That time has passed.' : 'That time is too soon or has passed. Please choose a later slot.');

  const packages = facility.packages.filter((p) => p.active);
  let pkg: (typeof packages)[number] | null = null;
  if (input.packageId) {
    pkg = packages.find((p) => p.id === input.packageId) ?? null;
    if (!pkg) throw new FormError('That package is not available.');
  } else if (facility.category === 'BOWLING_MACHINE' && packages.length > 0) {
    throw new FormError('Choose a rental package.');
  }

  let players: number | null = null;
  if (input.players !== null && input.players !== undefined && String(input.players) !== '') {
    players = Number(input.players);
    if (!Number.isInteger(players) || players < 1 || players > facility.capacity) throw new FormError(`${facility.name} takes up to ${facility.capacity} ${facility.capacity === 1 ? 'person' : 'people'} per booking.`);
  }

  const window: EquipmentWindow = { date: input.date, startMin, endMin, returnDate };
  const lines = await resolveEquipment(tx, input.equipment, window, ctx.excludeBookingId);
  if (equipmentOnly && lines.length === 0) throw new FormError('Add at least one item to rent.');

  const promo: (PromoConfig & { id: string }) | null = ctx.skipPromo ? null : await findPromo(tx, input.promoCode, facility.id);
  const q = quote({
    pricing: facility.pricing, pkg, slotMinutes: facility.slotMinutes, date: input.date,
    startMin: equipmentOnly ? 0 : startMin, endMin: equipmentOnly ? 0 : endMin,
    equipment: lines.map((l) => ({ name: l.item.name, qty: l.qty, unitPrice: l.item.rentalPrice, priceUnit: l.item.priceUnit })),
    days: rentalDays(input.date, returnDate), isStudent: ctx.isStudent, promo,
  });
  if (promo && !q.promoApplied) throw new FormError(`Promo code ${promo.code} needs a booking of at least ₹${promo.minAmount}.`);
  return { facility, pkg, equipmentOnly, startMin, endMin, returnDate, players, lines, promo, q };
}

/** Who the booking is for, checked against the database. */
export async function resolveWho(tx: Db, who: BookingWho, staff: boolean) {
  if (who.kind === 'CUSTOMER') {
    const c = await tx.rentalCustomer.findUnique({ where: { id: who.customerId } });
    if (!c || !c.active) throw new FormError('Your account is not active. Please contact the academy.');
    return { customerId: c.id as string | null, familyLoginId: null as string | null, studentId: null as string | null, isStudent: false, customerName: c.name, customerPhone: c.phone, customerEmail: c.email };
  }
  if (who.kind === 'FAMILY') {
    const [login, student] = await Promise.all([
      tx.familyLogin.findUnique({ where: { id: who.familyLoginId } }),
      tx.student.findUnique({ where: { id: String(who.studentId) }, select: { id: true, name: true, status: true, guardianPhone: true, guardianPhoneKey: true } }),
    ]);
    if (!login || !login.active || !student || student.guardianPhoneKey !== login.phoneKey) throw new FormError('Choose which of your children this booking is for.');
    return { customerId: null, familyLoginId: login.id, studentId: student.id, isStudent: student.status !== 'INACTIVE', customerName: student.name, customerPhone: student.guardianPhone, customerEmail: null };
  }
  if (!staff) throw new FormError('Please log in to book.');
  let name = (who.name ?? '').trim();
  let phone = (who.phone ?? '').trim();
  let studentId: string | null = null;
  let isStudent = false;
  let familyLoginId: string | null = null;
  if (who.studentId) {
    const student = await tx.student.findUnique({ where: { id: who.studentId }, select: { id: true, name: true, status: true, guardianPhone: true, guardianPhoneKey: true } });
    if (!student) throw new FormError('This student no longer exists.');
    studentId = student.id;
    isStudent = student.status !== 'INACTIVE';
    name = name || student.name;
    phone = phone || student.guardianPhone;
    if (student.guardianPhoneKey) familyLoginId = (await tx.familyLogin.findUnique({ where: { phoneKey: student.guardianPhoneKey }, select: { id: true } }))?.id ?? null;
  }
  if (name.length < 2 || name.length > 80) throw new FormError("Enter the customer's name.");
  const key = whatsappNumber(phone);
  if (!key) throw new FormError("Enter the customer's phone number.");
  // A walk-in whose phone already has a booking account is linked to it, so they see this booking too.
  const account = studentId ? null : await tx.rentalCustomer.findUnique({ where: { phoneKey: key }, select: { id: true, email: true } });
  const email = (who.email ?? '').trim().toLowerCase() || account?.email || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FormError('Enter a valid email address, or leave it empty.');
  return { customerId: account?.id ?? null, familyLoginId, studentId, isStudent, customerName: name, customerPhone: phone, customerEmail: email };
}

/** Price and resolved details of a booking request, without reserving anything (for the booking form). */
export async function previewBooking(input: BookingInput, viewer: { staff: boolean }) {
  const settings = await getRentalSettings();
  let isStudent = false;
  try {
    isStudent = (await resolveWho(db, input.who, viewer.staff)).isStudent;
  } catch {
    // Not chosen yet (e.g. staff has not picked the customer): price it as an outside customer.
  }
  let promoError: string | null = null;
  let p: Prepared;
  try {
    p = await prepare(db, input, { staff: viewer.staff, isStudent, settings, now: new Date() });
  } catch (e) {
    if (!(e instanceof FormError) || !input.promoCode || !/promo/i.test(e.message)) throw e;
    promoError = e.message;
    p = await prepare(db, input, { staff: viewer.staff, isStudent, settings, now: new Date(), skipPromo: true });
  }
  return {
    quote: p.q, isStudent, promoError, startMin: p.startMin, endMin: p.endMin, returnDate: p.returnDate,
    payNow: advanceDue({ total: p.q.total, deposit: p.q.deposit, paid: 0 }, settings.advancePercent),
  };
}

async function takeBookingCode(tx: Tx) {
  const ym = nowIST().date.slice(2, 7).replace('-', '');
  const key = `rental.seq:${ym}`;
  const rows = await tx.$queryRaw<{ value: string }[]>`
    INSERT INTO "Setting" ("key", "value") VALUES (${key}, '1')
    ON CONFLICT ("key") DO UPDATE SET "value" = CAST(CAST("Setting"."value" AS INTEGER) + 1 AS TEXT)
    RETURNING "value"`;
  return `BK-${ym}-${String(Number(rows[0].value)).padStart(4, '0')}`;
}

const earlier = (a: Date, b: Date) => (a.getTime() < b.getTime() ? a : b);

/** What an unpaid booking waits for, and until when its slot is held. */
function holdFor(method: string, payable: number, settings: RentalSettings, startsAt: Date, now: Date): { status: string; expiresAt: Date | null } {
  if (payable <= 0) return { status: 'CONFIRMED', expiresAt: null };
  if (method === 'ONLINE') return { status: 'PAYMENT_PENDING', expiresAt: new Date(now.getTime() + settings.holdMinutes * 60_000) };
  if (settings.offlineHoldHours > 0) return { status: 'PAYMENT_PENDING', expiresAt: earlier(new Date(now.getTime() + settings.offlineHoldHours * 3_600_000), startsAt) };
  return { status: 'CONFIRMED', expiresAt: null };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createBooking(input: BookingInput, actor: Actor) {
  const settings = await getRentalSettings();
  const staff = actor.type === 'STAFF';
  const method = input.paymentMethod === 'ONLINE' ? 'ONLINE' : 'PAY_AT_VENUE';
  if (!staff) {
    if (method === 'ONLINE' && !gatewayConfig()) throw new FormError('Online payment is not available yet. Choose "Pay at the academy".');
    if (method === 'PAY_AT_VENUE' && !settings.allowPayAtVenue) throw new FormError('Please pay online to book.');
  }

  const created = await rentalTx(async (tx) => {
    const now = new Date();
    await releaseExpired(tx, now);
    const who = await resolveWho(tx, input.who, staff);
    const p = await prepare(tx, input, { staff, isStudent: who.isStudent, settings, now });
    const { facility, pkg, startMin, endMin } = p;

    if (!staff) {
      const openHolds = await tx.rentalBooking.count({
        where: { status: 'PAYMENT_PENDING', ...(who.customerId ? { customerId: who.customerId } : { familyLoginId: who.familyLoginId }) },
      });
      if (openHolds >= MAX_OPEN_HOLDS) throw new FormError('You already have bookings waiting for payment. Pay for or cancel one of them first.');
    }

    // Reserve the unit(s). A machine + net package takes both in this same transaction: either both are reserved or neither.
    const reserve: { resourceId: string; role: string; name: string }[] = [];
    if (!p.equipmentOnly) {
      const unit = await findFreeResource(tx, facility, input.date, startMin, endMin, { onlyId: staff ? input.resourceId : null });
      if (!unit) throw new FormError(staff && input.resourceId ? 'That unit is not free at this time.' : 'That time is no longer available. Please pick another slot.');
      reserve.push({ resourceId: unit.id, role: 'PRIMARY', name: unit.name });
      if (pkg?.includesNet) {
        const nets = pkg.netFacilityId ? await tx.rentalFacility.findUnique({ where: { id: pkg.netFacilityId }, include: { resources: true } }) : null;
        if (!nets || nets.status !== 'ACTIVE') throw new FormError('The net for this package is not available right now. Choose a package without a net.');
        if (startMin < nets.openTime || endMin > nets.closeTime) throw new FormError(`${nets.name} is closed at that time.`);
        const net = await findFreeResource(tx, nets, input.date, startMin, endMin);
        if (!net) throw new FormError('No net is free at that time. Pick another slot, or a package without a net.');
        reserve.push({ resourceId: net.id, role: 'NET', name: net.name });
      }
    }

    const startsAt = instantOf(input.date, p.equipmentOnly ? endMin : startMin);
    const hold = staff
      ? { status: 'CONFIRMED', expiresAt: null as Date | null }
      : facility.requiresApproval
        ? { status: 'PENDING', expiresAt: startsAt }
        : holdFor(method, p.q.payable, settings, startsAt, now);

    const code = await takeBookingCode(tx);
    const booking = await tx.rentalBooking.create({
      data: {
        code, kind: p.equipmentOnly ? 'EQUIPMENT' : 'FACILITY', facilityId: facility.id, packageId: pkg?.id ?? null,
        customerId: who.customerId, familyLoginId: who.familyLoginId, studentId: who.studentId,
        customerType: who.isStudent ? 'STUDENT' : 'OUTSIDE', customerName: who.customerName, customerPhone: who.customerPhone, customerEmail: who.customerEmail,
        players: p.players, date: input.date, startMin, endMin, returnDate: p.returnDate,
        status: hold.status, expiresAt: hold.expiresAt,
        subtotal: p.q.subtotal, discount: p.q.discount, total: p.q.total, deposit: p.q.deposit,
        promoCode: p.promo?.code ?? null, priceLines: JSON.stringify(p.q.lines), paymentMethod: method,
        notes: (input.notes ?? '').trim().slice(0, 500) || null, source: staff ? 'STAFF' : 'ONLINE', createdBy: actor.name,
        resources: { create: reserve.map((r) => ({ resourceId: r.resourceId, role: r.role })) },
        equipment: { create: p.lines.map((l) => ({ itemId: l.item.id, qty: l.qty, unitPrice: l.item.rentalPrice, dueDate: p.returnDate ?? input.date })) },
      },
    });
    for (const r of reserve) {
      await tx.resourceSlot.createMany({ data: blocksOf(startMin, endMin).map((block) => ({ resourceId: r.resourceId, date: input.date, block, bookingId: booking.id })) });
    }
    for (const l of p.lines) {
      await tx.equipmentMovement.create({ data: { itemId: l.item.id, bookingId: booking.id, type: 'RESERVED', qty: l.qty, actor: actor.name } });
    }
    if (p.promo) await tx.rentalPromo.update({ where: { id: p.promo.id }, data: { usedCount: { increment: 1 } } });
    await audit(tx, {
      bookingId: booking.id, entity: 'BOOKING', action: 'Booking created', actor,
      detail: { status: hold.status, units: reserve.map((r) => r.name), total: p.q.total, deposit: p.q.deposit, method },
    });
    return { id: booking.id, code, status: hold.status };
  });

  await notifyBooking(created.id, created.status === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : 'BOOKING_RECEIVED');
  return created;
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

async function releaseHolds(tx: Tx, bookingId: string, actor: Actor, opts: { slots: boolean } = { slots: true }) {
  if (opts.slots) await tx.resourceSlot.deleteMany({ where: { bookingId } });
  const reserved = await tx.bookingEquipment.findMany({ where: { bookingId, status: 'RESERVED' } });
  for (const line of reserved) {
    await tx.bookingEquipment.update({ where: { id: line.id }, data: { status: 'RELEASED' } });
    await tx.equipmentMovement.create({ data: { itemId: line.itemId, bookingId, type: 'RELEASED', qty: line.qty, actor: actor.name } });
  }
}

/**
 * The one place a booking's status changes. Refuses any change that is not in TRANSITIONS and
 * applies what the new status implies (releasing slots, time stamps).
 */
export async function applyStatus(
  tx: Tx,
  bookingId: string,
  to: string,
  actor: Actor,
  extra: { note?: string | null; cancelReason?: string | null; cancelCharge?: number; expiresAt?: Date | null } = {},
) {
  const b = await tx.rentalBooking.findUnique({ where: { id: bookingId }, include: { equipment: true } });
  if (!b) throw new FormError('This booking no longer exists.');
  if (!canTransition(b.status, to)) throw new FormError(`A booking that is "${label(b.status)}" cannot be changed to "${label(to)}".`);
  const now = new Date();
  const today = nowIST(now);
  const data: Prisma.RentalBookingUncheckedUpdateInput = { status: to };

  if (to === 'CHECKED_IN') {
    if (b.date !== today.date) throw new FormError(b.date > today.date ? 'Check-in opens on the day of the booking.' : 'This booking was for an earlier day. Mark it as a no-show or cancel it.');
    data.checkedInAt = now;
  }
  if (to === 'IN_PROGRESS') data.startedAt = now;
  if (to === 'NO_SHOW' && instantOf(b.date, b.startMin).getTime() > now.getTime()) throw new FormError('A booking can be marked as a no-show only after its start time.');
  if (to === 'COMPLETED') {
    if (b.equipment.some((e) => e.status === 'ISSUED' || e.status === 'RETURNED')) throw new FormError('Equipment is still out or waiting for inspection. Record the return and inspection first.');
    data.completedAt = now;
    if (!b.startedAt) data.startedAt = b.checkedInAt ?? now;
    await releaseHolds(tx, b.id, actor, { slots: false }); // frees equipment that was reserved but never handed out
  }
  if (to === 'CONFIRMED' || to === 'PAYMENT_PENDING') data.expiresAt = extra.expiresAt ?? null;
  if (RELEASING.includes(to)) {
    await releaseHolds(tx, b.id, actor);
    data.expiresAt = null;
    if (to === 'CANCELLED') {
      data.cancelledAt = now;
      data.cancelReason = extra.cancelReason ?? null;
      data.cancelCharge = extra.cancelCharge ?? 0;
    }
    if (to === 'REJECTED') data.cancelReason = extra.cancelReason ?? null;
  }
  const updated = await tx.rentalBooking.update({ where: { id: b.id }, data });
  await audit(tx, { bookingId: b.id, entity: 'BOOKING', action: `${label(b.status)} → ${label(to)}`, detail: extra.note ?? extra.cancelReason ?? null, actor });
  return updated;
}

/** Approve a request that was waiting for the academy. It is confirmed, or waits for payment. */
export async function approveBooking(bookingId: string, actor: Actor) {
  const settings = await getRentalSettings();
  const status = await rentalTx(async (tx) => {
    await releaseExpired(tx);
    const b = await tx.rentalBooking.findUnique({ where: { id: bookingId } });
    if (!b) throw new FormError('This booking no longer exists.');
    if (b.status !== 'PENDING') throw new FormError(`This booking is "${label(b.status)}", not waiting for approval.`);
    const now = new Date();
    const startsAt = instantOf(b.date, b.kind === 'EQUIPMENT' ? b.endMin : b.startMin);
    const due = advanceDue(b, settings.advancePercent);
    let next = holdFor(b.paymentMethod, due, settings, startsAt, now);
    // After approval an online payer gets a day (not minutes) to pay, as they may not be online right now.
    if (next.status === 'PAYMENT_PENDING' && b.paymentMethod === 'ONLINE') next = { status: 'PAYMENT_PENDING', expiresAt: earlier(new Date(now.getTime() + 24 * 3_600_000), startsAt) };
    await applyStatus(tx, b.id, next.status, actor, { note: 'Approved', expiresAt: next.expiresAt });
    return next.status;
  });
  await notifyBooking(bookingId, status === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : 'BOOKING_RECEIVED');
  return status;
}

async function refundIfPaid(tx: Tx, b: { id: string; paid: number }, keep: number, reason: string, actor: Actor) {
  const amount = Math.max(0, b.paid - keep);
  if (amount > 0) {
    const refund = await tx.rentalRefund.create({ data: { bookingId: b.id, amount, reason, requestedBy: actor.name } });
    await audit(tx, { bookingId: b.id, entity: 'REFUND', entityId: refund.id, action: 'Refund due', detail: { amount, reason }, actor });
  }
  return amount;
}

export async function rejectBooking(bookingId: string, reason: string | null, actor: Actor) {
  await rentalTx(async (tx) => {
    const b = await applyStatus(tx, bookingId, 'REJECTED', actor, { cancelReason: reason });
    await refundIfPaid(tx, b, 0, 'Booking not approved', actor);
  });
  await notifyBooking(bookingId, 'REJECTED', { note: reason ? `Reason: ${reason}` : null });
}

/**
 * Cancel a booking that has not started. The facility's cancellation policy decides the charge
 * (never more than what was paid); anything paid above it becomes a refund for staff to process.
 */
export async function cancelBooking(bookingId: string, actor: Actor, opts: { reason?: string | null; byCustomer: boolean; waiveCharge?: boolean }) {
  const result = await rentalTx(async (tx) => {
    const b = await tx.rentalBooking.findUnique({ where: { id: bookingId }, include: { facility: { include: { pricing: true } } } });
    if (!b) throw new FormError('This booking no longer exists.');
    if (!UPCOMING.includes(b.status)) throw new FormError(`A booking that is "${label(b.status)}" cannot be cancelled.`);
    const hours = hoursUntil(b.date, b.startMin);
    if (opts.byCustomer && hours <= 0) throw new FormError('This booking has already started. Please contact the academy.');
    const policyCharge = opts.waiveCharge || b.status !== 'CONFIRMED' ? 0 : cancellationCharge(b.total, hours, b.facility.pricing);
    const charge = Math.min(policyCharge, b.paid);
    await applyStatus(tx, b.id, 'CANCELLED', actor, { cancelReason: opts.reason?.trim().slice(0, 300) || null, cancelCharge: charge });
    const refund = await refundIfPaid(tx, b, charge, 'Booking cancelled', actor);
    return { charge, refund };
  });
  const note = [result.charge > 0 ? `Cancellation charge: ₹${result.charge}.` : '', result.refund > 0 ? `₹${result.refund} will be refunded.` : ''].filter(Boolean).join(' ');
  await notifyBooking(bookingId, 'CANCELLED', { note: note || null });
  return result;
}

/** Arrived / session started / finished / did not come. */
export async function moveBooking(bookingId: string, to: 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW', actor: Actor) {
  return rentalTx((tx) => applyStatus(tx, bookingId, to, actor));
}

// ---------------------------------------------------------------------------
// Reschedule
// ---------------------------------------------------------------------------

export async function rescheduleBooking(
  bookingId: string,
  change: { date: string; startMin?: number | null; resourceId?: string | null },
  actor: Actor,
  opts: { byCustomer: boolean },
) {
  const settings = await getRentalSettings();
  const staff = actor.type === 'STAFF';
  await rentalTx(async (tx) => {
    const now = new Date();
    await releaseExpired(tx, now);
    const b = await tx.rentalBooking.findUnique({ where: { id: bookingId }, include: { resources: { include: { resource: true } }, equipment: true } });
    if (!b) throw new FormError('This booking no longer exists.');
    if (!UPCOMING.includes(b.status)) throw new FormError(`A booking that is "${label(b.status)}" cannot be rescheduled.`);
    if (opts.byCustomer) {
      if (hoursUntil(b.date, b.startMin, now) < settings.rescheduleCutoffHours) throw new FormError(`Bookings can be rescheduled until ${settings.rescheduleCutoffHours} hours before the start. Please contact the academy.`);
      if (b.rescheduleCount >= settings.maxReschedules) throw new FormError(`A booking can be rescheduled ${settings.maxReschedules} times. Please contact the academy.`);
    }

    // Same facility, package, length and equipment; only the day and start time move.
    const days = rentalDays(b.date, b.returnDate);
    const facilityOf = await tx.rentalFacility.findUnique({ where: { id: b.facilityId }, select: { slotMinutes: true } });
    const input: BookingInput = {
      facilityId: b.facilityId, packageId: b.packageId, date: change.date,
      startMin: change.startMin ?? b.startMin, slots: Math.round((b.endMin - b.startMin) / (facilityOf?.slotMinutes || 60)),
      returnDate: b.kind === 'EQUIPMENT' && validDate(change.date) ? addDays(change.date, days - 1) : null,
      equipment: b.equipment.filter((e) => e.status === 'RESERVED').map((e) => ({ itemId: e.itemId, qty: e.qty })),
      players: b.players, paymentMethod: b.paymentMethod as 'ONLINE' | 'PAY_AT_VENUE',
      who: { kind: 'WALK_IN', name: b.customerName, phone: b.customerPhone },
    };
    const p = await prepare(tx, input, { staff, isStudent: b.customerType === 'STUDENT', settings, now, excludeBookingId: b.id, skipPromo: true });
    if (change.date === b.date && p.startMin === b.startMin && !(staff && change.resourceId)) throw new FormError('Choose a different day or time.');

    // Re-price with today's prices, keeping the promo code the booking was made with.
    const promo = b.promoCode ? await tx.rentalPromo.findUnique({ where: { code: b.promoCode } }) : null;
    const q: Quote = quote({
      pricing: p.facility.pricing, pkg: p.pkg, slotMinutes: p.facility.slotMinutes, date: change.date,
      startMin: p.equipmentOnly ? 0 : p.startMin, endMin: p.equipmentOnly ? 0 : p.endMin,
      equipment: p.lines.map((l) => ({ name: l.item.name, qty: l.qty, unitPrice: l.item.rentalPrice, priceUnit: l.item.priceUnit })),
      days, isStudent: b.customerType === 'STUDENT',
      promo: promo ? { code: promo.code, percentOff: promo.percentOff, amountOff: promo.amountOff, minAmount: promo.minAmount } : null,
    });

    // Move the units: free this booking's own slots, then reserve the new time (the same unit when it is free).
    await tx.resourceSlot.deleteMany({ where: { bookingId: b.id } });
    const moved: { from: string; to: string; role: string }[] = [];
    for (const held of b.resources) {
      const facility = held.role === 'PRIMARY' ? p.facility : await tx.rentalFacility.findUnique({ where: { id: held.resource.facilityId }, include: { resources: true } });
      if (!facility) throw new FormError('A unit of this booking no longer exists.');
      if (held.role === 'NET' && (facility.status !== 'ACTIVE' || p.startMin < facility.openTime || p.endMin > facility.closeTime)) {
        throw new FormError(`${facility.name} is not open at that time.`);
      }
      const wantOnly = staff && held.role === 'PRIMARY' ? change.resourceId : null;
      const unit = await findFreeResource(tx, facility, change.date, p.startMin, p.endMin, { onlyId: wantOnly, preferId: held.resourceId });
      if (!unit) throw new FormError(held.role === 'NET' ? 'No net is free at that time.' : 'That time is not available. Please pick another slot.');
      if (unit.id !== held.resourceId) {
        await tx.bookingResource.delete({ where: { bookingId_resourceId: { bookingId: b.id, resourceId: held.resourceId } } });
        await tx.bookingResource.create({ data: { bookingId: b.id, resourceId: unit.id, role: held.role } });
      }
      await tx.resourceSlot.createMany({ data: blocksOf(p.startMin, p.endMin).map((block) => ({ resourceId: unit.id, date: change.date, block, bookingId: b.id })) });
      moved.push({ from: held.resource.name, to: unit.name, role: held.role });
    }

    const charges = (JSON.parse(b.priceLines || '[]') as PriceLine[]).filter((l) => l.kind === 'CHARGE');
    const total = q.total + b.extraCharges;
    await tx.rentalBooking.update({
      where: { id: b.id },
      data: {
        date: change.date, startMin: p.startMin, endMin: p.endMin, returnDate: p.returnDate,
        subtotal: q.subtotal, discount: q.discount, total, deposit: q.deposit, priceLines: JSON.stringify([...q.lines, ...charges]),
        rescheduleCount: { increment: 1 },
        // A request still waiting for approval is held until its (new) start.
        ...(b.status === 'PENDING' ? { expiresAt: instantOf(change.date, p.equipmentOnly ? p.endMin : p.startMin) } : {}),
      },
    });
    await tx.bookingEquipment.updateMany({ where: { bookingId: b.id, status: 'RESERVED' }, data: { dueDate: p.returnDate ?? change.date } });
    await audit(tx, {
      bookingId: b.id, entity: 'BOOKING', action: 'Rescheduled', actor,
      detail: { from: { date: b.date, startMin: b.startMin, total: b.total }, to: { date: change.date, startMin: p.startMin, total }, units: moved },
    });
    // If the new time costs less than what was already paid, the difference is refunded.
    await refundIfPaid(tx, { id: b.id, paid: b.paid }, total + q.deposit, 'Rescheduled to a cheaper slot', actor);
  });
  await notifyBooking(bookingId, 'RESCHEDULED');
}

/** Notes and head-count: the only free-form edits on a booking. Time and money change through reschedule and payments. */
export async function updateBookingDetails(bookingId: string, data: { notes?: string | null; staffNotes?: string | null; players?: number | null }, actor: Actor) {
  await rentalTx(async (tx) => {
    const b = await tx.rentalBooking.findUnique({ where: { id: bookingId }, include: { facility: { select: { capacity: true, name: true } } } });
    if (!b) throw new FormError('This booking no longer exists.');
    if (data.players !== undefined && data.players !== null && (!Number.isInteger(data.players) || data.players < 1 || data.players > b.facility.capacity)) {
      throw new FormError(`${b.facility.name} takes up to ${b.facility.capacity} people per booking.`);
    }
    await tx.rentalBooking.update({
      where: { id: bookingId },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes?.trim().slice(0, 500) || null } : {}),
        ...(data.staffNotes !== undefined ? { staffNotes: data.staffNotes?.trim().slice(0, 1000) || null } : {}),
        ...(data.players !== undefined ? { players: data.players } : {}),
      },
    });
    await audit(tx, { bookingId, entity: 'BOOKING', action: 'Details edited', detail: data, actor });
  });
}

