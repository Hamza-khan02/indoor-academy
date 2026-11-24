'use server';

// Staff actions for the bookings section. Each one checks the staff member's role first
// (rentalActor) and then calls the booking engine in lib/rentals, which re-checks everything
// against the database.
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { FormError, date, int, oneOf, run, text } from '@/lib/form';
import { customerSlots } from '@/lib/rentals/availability';
import {
  type BookingInput, approveBooking, cancelBooking, createBooking, moveBooking, previewBooking, rejectBooking, rescheduleBooking, updateBookingDetails,
} from '@/lib/rentals/booking';
import {
  CATEGORIES, CATEGORY_KEYS, EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS, EQUIPMENT_PRICE_UNITS, HOLDING, MACHINE_PACKAGE_KINDS, PACKAGE_KINDS, PRICE_UNITS, SLOT_LENGTHS,
} from '@/lib/rentals/constants';
import { type Actor, audit } from '@/lib/rentals/core';
import { adjustStock, inspectLine, issueLine, returnLine } from '@/lib/rentals/equipment';
import { createRefund, declineRefund, processRefund, recordOfflinePayment, refundViaGateway } from '@/lib/rentals/payments';
import { DEFAULT_RENTAL_SETTINGS, saveRentalSettings } from '@/lib/rentals/settings';
import { rentalActor } from '@/lib/rentals/staff';
import { BLOCK, overlaps } from '@/lib/rentals/time';

const done = () => revalidatePath('/', 'layout');

/** A time of day from a dropdown: minutes from midnight on a quarter hour. */
function quarter(fd: FormData, key: string, label: string, required = true) {
  const value = int(fd, key, { required, label, min: 0, max: 1440 });
  if (value !== null && value % BLOCK !== 0) throw new FormError(`${label} must be on a quarter hour.`);
  return value;
}
const money = (fd: FormData, key: string, label: string) => int(fd, key, { label, min: 0, max: 1_000_000 }) ?? 0;
const percent = (fd: FormData, key: string, label: string) => int(fd, key, { label, min: 0, max: 100 }) ?? 0;
const checked = (fd: FormData, key: string) => fd.get(key) === 'on' || fd.get(key) === 'true';

// ---------------------------------------------------------------------------
// Facilities and their units
// ---------------------------------------------------------------------------

const CODE_PREFIX: Record<string, string> = { NETS: 'NET', TURF: 'TURF', PITCH: 'PITCH', BOWLING_MACHINE: 'BM', EQUIPMENT: 'EQ' };

async function parseFacility(fd: FormData) {
  const branchId = text(fd, 'branchId');
  if (branchId && !(await db.branch.findUnique({ where: { id: branchId } }))) throw new FormError('Choose a valid branch.');
  const openTime = quarter(fd, 'openTime', 'Opening time')!;
  const closeTime = quarter(fd, 'closeTime', 'Closing time')!;
  const slotMinutes = int(fd, 'slotMinutes', { required: true, label: 'Slot length' })!;
  if (!SLOT_LENGTHS.includes(slotMinutes)) throw new FormError('Choose a slot length.');
  if (closeTime - openTime < slotMinutes) throw new FormError('Closing time must be at least one slot after opening time.');
  return {
    name: text(fd, 'name', { required: true, label: 'Name', max: 60 }),
    description: text(fd, 'description', { label: 'Description', max: 400 }),
    branchId,
    capacity: int(fd, 'capacity', { required: true, label: 'Capacity', min: 1, max: 200 })!,
    openTime, closeTime, slotMinutes,
    maxSlots: int(fd, 'maxSlots', { required: true, label: 'Longest booking', min: 1, max: 16 })!,
    requiresApproval: checked(fd, 'requiresApproval'),
  };
}

/** Next free codes like NET-3, NET-4 for new units. */
async function nextCodes(prefix: string, count: number) {
  const existing = new Set((await db.rentalResource.findMany({ where: { code: { startsWith: `${prefix}-` } }, select: { code: true } })).map((r) => r.code));
  const codes: string[] = [];
  for (let n = 1; codes.length < count; n++) {
    const code = `${prefix}-${String(n).padStart(2, '0')}`;
    if (!existing.has(code)) codes.push(code);
  }
  return codes;
}

export async function createFacility(fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const category = oneOf(fd, 'category', CATEGORY_KEYS, { required: true, label: 'Type' })!;
    const data = await parseFacility(fd);
    const equipmentOnly = category === 'EQUIPMENT';
    const units = equipmentOnly ? 0 : int(fd, 'units', { required: true, label: 'Number of units', min: 1, max: 20 })!;
    const codes = await nextCodes(CODE_PREFIX[category], units);
    const facility = await db.rentalFacility.create({
      data: {
        ...data, category, status: 'INACTIVE', // switched off until prices are set
        pricing: { create: { unit: equipmentOnly ? 'PER_ITEM' : 'PER_HOUR', updatedBy: actor.name } },
        resources: { create: codes.map((code, i) => ({ code, name: `${CATEGORIES[category].unit} ${i + 1}` })) },
        // The five standard bowling machine packages, switched off until they are priced.
        packages: category === 'BOWLING_MACHINE'
          ? { create: MACHINE_PACKAGE_KINDS.map((kind, i) => ({ kind, name: PACKAGE_KINDS[kind].label, includesNet: PACKAGE_KINDS[kind].net, includesOperator: PACKAGE_KINDS[kind].operator, includesBalls: PACKAGE_KINDS[kind].balls, sortOrder: i })) }
          : undefined,
      },
    });
    await audit(db, { entity: 'FACILITY', entityId: facility.id, action: 'Facility added', detail: { name: data.name, category, units }, actor });
    done();
    return `${data.name} added. Set its prices, then open it for booking.`;
  });
}

export async function updateFacility(id: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const data = await parseFacility(fd);
    await db.rentalFacility.update({ where: { id }, data });
    await audit(db, { entity: 'FACILITY', entityId: id, action: 'Facility edited', detail: data, actor });
    done();
    return `${data.name} saved`;
  });
}

async function upcomingOn(where: { facilityId?: string; resourceId?: string }, today: string) {
  return db.rentalBooking.count({
    where: { status: { in: HOLDING }, date: { gte: today }, resources: { some: where.resourceId ? { resourceId: where.resourceId } : { resource: { facilityId: where.facilityId } } } },
  });
}
const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** Open for booking / under maintenance / switched off. */
export async function setFacilityStatus(id: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const status = oneOf(fd, 'status', ['ACTIVE', 'MAINTENANCE', 'INACTIVE'], { required: true, label: 'Status' })!;
    const note = text(fd, 'maintenanceNote', { label: 'Note', max: 200 });
    const facility = await db.rentalFacility.findUnique({ where: { id }, include: { pricing: true, resources: true, packages: true } });
    if (!facility) throw new FormError('This facility no longer exists.');
    if (status === 'ACTIVE') {
      if (facility.category !== 'EQUIPMENT') {
        if (!facility.resources.some((r) => r.status === 'ACTIVE')) throw new FormError('Add at least one available unit before opening it for booking.');
        const priced = (facility.pricing?.price ?? 0) > 0 || facility.packages.some((p) => p.active && (p.pricePerUnit ?? 0) > 0);
        if (!priced) throw new FormError('Set a price for this facility first (Pricing), then open it for booking.');
      } else if ((await db.equipmentItem.count({ where: { active: true } })) === 0) {
        throw new FormError('Add equipment items first (Equipment), then open the rental counter.');
      }
    }
    await db.rentalFacility.update({ where: { id }, data: { status, maintenanceNote: status === 'ACTIVE' ? null : note } });
    await audit(db, { entity: 'FACILITY', entityId: id, action: `Facility status: ${status}`, detail: note, actor });
    done();
    const upcoming = status === 'ACTIVE' ? 0 : await upcomingOn({ facilityId: id }, todayIST());
    return upcoming > 0 ? `Saved. ${upcoming} upcoming booking(s) still use it: reschedule or cancel them.` : 'Status saved';
  });
}

export async function deleteFacility(id: string) {
  return run(async () => {
    const actor = await rentalActor('config');
    const facility = await db.rentalFacility.findUnique({ where: { id }, include: { _count: { select: { bookings: true, netPackages: true } }, resources: { include: { _count: { select: { bookings: true } } } } } });
    if (!facility) throw new FormError('This facility no longer exists.');
    if (facility._count.bookings > 0 || facility.resources.some((r) => r._count.bookings > 0)) throw new FormError('This facility has bookings, so it cannot be deleted. Switch it off instead to keep its history.');
    if (facility._count.netPackages > 0) throw new FormError('A bowling machine package reserves its net from this facility. Change that package first.');
    await db.rentalFacility.delete({ where: { id } });
    await audit(db, { entity: 'FACILITY', entityId: id, action: 'Facility deleted', detail: facility.name, actor });
    done();
    return `${facility.name} deleted`;
  });
}

function parseResource(fd: FormData) {
  const speedMin = int(fd, 'speedMin', { label: 'Lowest speed', min: 20, max: 200 });
  const speedMax = int(fd, 'speedMax', { label: 'Highest speed', min: 20, max: 200 });
  if (speedMin !== null && speedMax !== null && speedMax < speedMin) throw new FormError('Highest speed cannot be below the lowest speed.');
  return {
    name: text(fd, 'name', { required: true, label: 'Name', max: 40 }),
    code: text(fd, 'code', { required: true, label: 'Unique ID', max: 20 }).toUpperCase().replace(/\s+/g, '-'),
    status: oneOf(fd, 'status', ['ACTIVE', 'MAINTENANCE', 'INACTIVE'], { required: true, label: 'Status' })!,
    maintenanceNote: text(fd, 'maintenanceNote', { label: 'Maintenance note', max: 200 }),
    speedMin, speedMax,
    modes: text(fd, 'modes', { label: 'Bowling modes', max: 120 }),
    notes: text(fd, 'notes', { label: 'Notes', max: 300 }),
  };
}

export async function saveResource(facilityId: string, id: string | null, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const data = parseResource(fd);
    const clash = await db.rentalResource.findUnique({ where: { code: data.code } });
    if (clash && clash.id !== id) throw new FormError(`The ID ${data.code} is already used by ${clash.name}.`);
    const saved = id ? await db.rentalResource.update({ where: { id }, data }) : await db.rentalResource.create({ data: { ...data, facilityId } });
    await audit(db, { entity: 'RESOURCE', entityId: saved.id, action: id ? 'Unit edited' : 'Unit added', detail: data, actor });
    done();
    const upcoming = data.status === 'ACTIVE' ? 0 : await upcomingOn({ resourceId: saved.id }, todayIST());
    return upcoming > 0 ? `${data.name} saved. ${upcoming} upcoming booking(s) still use it: move them to another unit.` : `${data.name} saved`;
  });
}

export async function deleteResource(id: string) {
  return run(async () => {
    const actor = await rentalActor('config');
    const unit = await db.rentalResource.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
    if (!unit) throw new FormError('This unit no longer exists.');
    if (unit._count.bookings > 0) throw new FormError('This unit has bookings, so it cannot be deleted. Switch it off instead.');
    await db.rentalResource.delete({ where: { id } });
    await audit(db, { entity: 'RESOURCE', entityId: id, action: 'Unit deleted', detail: unit.name, actor });
    done();
    return `${unit.name} deleted`;
  });
}

// ---------------------------------------------------------------------------
// Blockouts (blocked dates / timings, maintenance windows)
// ---------------------------------------------------------------------------

export async function saveBlockout(facilityId: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const fromDate = date(fd, 'fromDate', { required: true, label: 'From date' })!;
    const toDate = date(fd, 'toDate', { label: 'To date' }) ?? fromDate;
    if (toDate < fromDate) throw new FormError('The end date cannot be before the start date.');
    const allDay = checked(fd, 'allDay');
    const startMin = allDay ? null : quarter(fd, 'startMin', 'From time');
    const endMin = allDay ? null : quarter(fd, 'endMin', 'To time');
    if (!allDay && (startMin === null || endMin === null || endMin <= startMin)) throw new FormError('The end time must be after the start time.');
    const resourceId = text(fd, 'resourceId');
    const facility = await db.rentalFacility.findUnique({ where: { id: facilityId }, include: { resources: true } });
    if (!facility) throw new FormError('This facility no longer exists.');
    if (resourceId && !facility.resources.some((r) => r.id === resourceId)) throw new FormError('Choose a unit of this facility.');

    // A blockout must not sit on top of live bookings: staff move or cancel those first.
    const live = await db.rentalBooking.findMany({
      where: {
        status: { in: HOLDING }, date: { gte: fromDate, lte: toDate },
        resources: { some: resourceId ? { resourceId } : { resource: { facilityId } } },
      },
      select: { code: true, startMin: true, endMin: true },
    });
    const hit = live.filter((b) => allDay || overlaps(b.startMin, b.endMin, startMin!, endMin!));
    if (hit.length > 0) throw new FormError(`${hit.length} booking(s) already fall in that time (first: ${hit[0].code}). Reschedule or cancel them first.`);

    const blockout = await db.facilityBlockout.create({
      data: {
        facilityId, resourceId, fromDate, toDate, startMin, endMin, createdBy: actor.name,
        kind: oneOf(fd, 'kind', ['MAINTENANCE', 'BLOCKED'], { required: true, label: 'Reason type' })!,
        reason: text(fd, 'reason', { label: 'Reason', max: 120 }),
      },
    });
    await audit(db, { entity: 'BLOCKOUT', entityId: blockout.id, action: 'Blockout added', detail: { facility: facility.name, fromDate, toDate, startMin, endMin, resourceId }, actor });
    done();
    return 'Time blocked';
  });
}

export async function deleteBlockout(id: string) {
  return run(async () => {
    const actor = await rentalActor('config');
    const blockout = await db.facilityBlockout.delete({ where: { id } });
    await audit(db, { entity: 'BLOCKOUT', entityId: id, action: 'Blockout removed', detail: { fromDate: blockout.fromDate, toDate: blockout.toDate }, actor });
    done();
    return 'Blockout removed';
  });
}

// ---------------------------------------------------------------------------
// Pricing, packages, promo codes
// ---------------------------------------------------------------------------

export async function savePricing(facilityId: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const facility = await db.rentalFacility.findUnique({ where: { id: facilityId } });
    if (!facility) throw new FormError('This facility no longer exists.');
    const equipmentOnly = facility.category === 'EQUIPMENT';
    const unit = equipmentOnly ? 'PER_ITEM' : oneOf(fd, 'unit', Object.keys(PRICE_UNITS).filter((u) => u !== 'PER_ITEM'), { required: true, label: 'Charged' })!;
    const peakStart = quarter(fd, 'peakStart', 'Peak from', false);
    const peakEnd = quarter(fd, 'peakEnd', 'Peak until', false);
    const peakSurchargePct = int(fd, 'peakSurchargePct', { label: 'Peak extra', min: 0, max: 300 }) ?? 0;
    if (peakSurchargePct > 0 && (peakStart === null || peakEnd === null || peakEnd <= peakStart)) throw new FormError('Choose when peak hours start and end.');
    const data = {
      unit,
      price: equipmentOnly ? 0 : money(fd, 'price', 'Price'),
      studentDiscountPct: percent(fd, 'studentDiscountPct', 'Student discount'),
      peakStart: peakSurchargePct > 0 ? peakStart : null,
      peakEnd: peakSurchargePct > 0 ? peakEnd : null,
      peakSurchargePct,
      weekendSurchargePct: int(fd, 'weekendSurchargePct', { label: 'Weekend extra', min: 0, max: 300 }) ?? 0,
      securityDeposit: money(fd, 'securityDeposit', 'Security deposit'),
      cancelFreeHours: int(fd, 'cancelFreeHours', { label: 'Free cancellation', min: 0, max: 720 }) ?? 0,
      cancelChargePct: percent(fd, 'cancelChargePct', 'Cancellation charge'),
      updatedBy: actor.name,
    };
    await db.rentalPricing.upsert({ where: { facilityId }, create: { facilityId, ...data }, update: data });
    await audit(db, { entity: 'PRICING', entityId: facilityId, action: 'Prices changed', detail: { facility: facility.name, ...data }, actor });
    done();
    return `Prices for ${facility.name} saved. They apply to new bookings.`;
  });
}

export async function savePackage(facilityId: string, id: string | null, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const includesNet = checked(fd, 'includesNet');
    const netFacilityId = includesNet ? text(fd, 'netFacilityId') : null;
    if (includesNet) {
      const nets = netFacilityId ? await db.rentalFacility.findUnique({ where: { id: netFacilityId } }) : null;
      if (!nets || nets.category !== 'NETS') throw new FormError('Choose which nets facility the net is reserved from.');
    }
    const priceRaw = int(fd, 'pricePerUnit', { label: 'Package price', min: 0, max: 1_000_000 });
    const data = {
      name: text(fd, 'name', { required: true, label: 'Name', max: 60 }),
      description: text(fd, 'description', { label: 'Description', max: 200 }),
      includesNet, netFacilityId,
      includesOperator: checked(fd, 'includesOperator'),
      includesBalls: checked(fd, 'includesBalls'),
      pricePerUnit: priceRaw === null || priceRaw === 0 ? null : priceRaw,
      operatorCharge: money(fd, 'operatorCharge', 'Operator charge'),
      ballsCharge: money(fd, 'ballsCharge', 'Balls charge'),
      active: checked(fd, 'active'),
    };
    const saved = id
      ? await db.rentalPackage.update({ where: { id }, data })
      : await db.rentalPackage.create({ data: { ...data, facilityId, kind: 'CUSTOM', sortOrder: 99 } });
    await audit(db, { entity: 'PACKAGE', entityId: saved.id, action: id ? 'Package edited' : 'Package added', detail: data, actor });
    done();
    return `${data.name} saved`;
  });
}

export async function deletePackage(id: string) {
  return run(async () => {
    const actor = await rentalActor('config');
    const pkg = await db.rentalPackage.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
    if (!pkg) throw new FormError('This package no longer exists.');
    if (pkg._count.bookings > 0) throw new FormError('Bookings were made with this package. Switch it off instead of deleting it.');
    await db.rentalPackage.delete({ where: { id } });
    await audit(db, { entity: 'PACKAGE', entityId: id, action: 'Package deleted', detail: pkg.name, actor });
    done();
    return `${pkg.name} deleted`;
  });
}

export async function savePromo(id: string | null, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const code = text(fd, 'code', { required: true, label: 'Code', max: 20 }).toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new FormError('The code can use 3 to 20 letters and numbers, no spaces.');
    const percentOff = percent(fd, 'percentOff', 'Percent off');
    const amountOff = money(fd, 'amountOff', 'Amount off');
    if (percentOff === 0 && amountOff === 0) throw new FormError('Enter a percent off or an amount off.');
    const validFrom = date(fd, 'validFrom', { label: 'Valid from' });
    const validTo = date(fd, 'validTo', { label: 'Valid until' });
    if (validFrom && validTo && validTo < validFrom) throw new FormError('"Valid until" cannot be before "valid from".');
    const facilityId = text(fd, 'facilityId');
    const data = {
      code, percentOff, amountOff, validFrom, validTo, facilityId,
      description: text(fd, 'description', { label: 'Description', max: 120 }),
      minAmount: money(fd, 'minAmount', 'Minimum booking amount'),
      maxUses: int(fd, 'maxUses', { label: 'Number of uses', min: 1, max: 100_000 }),
      active: checked(fd, 'active'),
    };
    const clash = await db.rentalPromo.findUnique({ where: { code } });
    if (clash && clash.id !== id) throw new FormError(`The code ${code} already exists.`);
    const saved = id ? await db.rentalPromo.update({ where: { id }, data }) : await db.rentalPromo.create({ data });
    await audit(db, { entity: 'PROMO', entityId: saved.id, action: id ? 'Promo code edited' : 'Promo code added', detail: data, actor });
    done();
    return `Promo code ${code} saved`;
  });
}

export async function deletePromo(id: string) {
  return run(async () => {
    const actor = await rentalActor('config');
    const promo = await db.rentalPromo.delete({ where: { id } });
    await audit(db, { entity: 'PROMO', entityId: id, action: 'Promo code deleted', detail: promo.code, actor });
    done();
    return `Promo code ${promo.code} deleted`;
  });
}

// ---------------------------------------------------------------------------
// Equipment inventory
// ---------------------------------------------------------------------------

export async function saveEquipmentItem(id: string | null, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const code = text(fd, 'code', { required: true, label: 'Equipment ID', max: 20 }).toUpperCase().replace(/\s+/g, '-');
    const data = {
      code,
      name: text(fd, 'name', { required: true, label: 'Name', max: 60 }),
      category: oneOf(fd, 'category', Object.keys(EQUIPMENT_CATEGORIES), { required: true, label: 'Category' })!,
      condition: oneOf(fd, 'condition', Object.keys(EQUIPMENT_CONDITIONS), { required: true, label: 'Condition' })!,
      rentalPrice: money(fd, 'rentalPrice', 'Rental price'),
      priceUnit: oneOf(fd, 'priceUnit', Object.keys(EQUIPMENT_PRICE_UNITS), { required: true, label: 'Charged' })!,
      replacementCost: money(fd, 'replacementCost', 'Replacement cost'),
      notes: text(fd, 'notes', { label: 'Notes', max: 300 }),
      active: checked(fd, 'active'),
    };
    const clash = await db.equipmentItem.findUnique({ where: { code } });
    if (clash && clash.id !== id) throw new FormError(`The ID ${code} is already used by ${clash.name}.`);
    if (id) {
      await db.equipmentItem.update({ where: { id }, data });
      await audit(db, { entity: 'EQUIPMENT', entityId: id, action: 'Item edited', detail: data, actor });
    } else {
      const totalQty = int(fd, 'totalQty', { required: true, label: 'Quantity', min: 0, max: 10_000 })!;
      const item = await db.equipmentItem.create({ data: { ...data, totalQty } });
      if (totalQty > 0) await db.equipmentMovement.create({ data: { itemId: item.id, type: 'ADJUSTED', qty: totalQty, note: 'Opening stock', actor: actor.name } });
      await audit(db, { entity: 'EQUIPMENT', entityId: item.id, action: 'Item added', detail: { ...data, totalQty }, actor });
    }
    done();
    return `${data.name} saved`;
  });
}

export async function adjustEquipment(id: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const type = oneOf(fd, 'type', ['ADD', 'REMOVE', 'REPAIRED', 'WRITTEN_OFF'], { required: true, label: 'Change' })!;
    const qty = int(fd, 'qty', { required: true, label: 'Quantity', min: 1, max: 10_000 })!;
    const note = text(fd, 'note', { label: 'Note', max: 200 });
    const message = await adjustStock(id, type === 'ADD' ? { type: 'ADJUSTED', qty, note } : type === 'REMOVE' ? { type: 'ADJUSTED', qty: -qty, note } : { type, qty, note }, actor);
    done();
    return message;
  });
}

export async function deleteEquipmentItem(id: string) {
  return run(async () => {
    const actor = await rentalActor('config');
    const item = await db.equipmentItem.findUnique({ where: { id }, include: { _count: { select: { lines: true } } } });
    if (!item) throw new FormError('This item no longer exists.');
    if (item._count.lines > 0) throw new FormError('This item has rental history. Switch it off instead of deleting it.');
    await db.equipmentItem.delete({ where: { id } });
    await audit(db, { entity: 'EQUIPMENT', entityId: id, action: 'Item deleted', detail: item.name, actor });
    done();
    return `${item.name} deleted`;
  });
}

export async function equipmentStep(lineId: string, step: 'ISSUE' | 'RETURN') {
  return run(async () => {
    const actor = await rentalActor('manage');
    const message = step === 'ISSUE' ? await issueLine(lineId, actor) : await returnLine(lineId, actor);
    done();
    return message;
  });
}

export async function inspectEquipment(lineId: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('manage');
    const message = await inspectLine(lineId, {
      damagedQty: int(fd, 'damagedQty', { label: 'Damaged', min: 0, max: 1000 }) ?? 0,
      missingQty: int(fd, 'missingQty', { label: 'Missing', min: 0, max: 1000 }) ?? 0,
      charge: money(fd, 'charge', 'Charge'),
      note: text(fd, 'note', { label: 'Note', max: 200 }),
    }, actor);
    done();
    return message;
  });
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/** The booking form (staff side): free start times, price preview and creating the booking. */
export async function staffSlots(facilityId: string, day: string, packageId: string | null) {
  await rentalActor('create');
  return customerSlots(facilityId, day, packageId, { staff: true });
}

export async function staffQuote(input: BookingInput) {
  try {
    await rentalActor('create');
    return { ok: true as const, ...(await previewBooking(input, { staff: true })) };
  } catch (e) {
    if (e instanceof FormError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function staffCreateBooking(input: BookingInput, payment: { amount: number; method: string; reference: string } | null) {
  let id = '';
  const result = await run(async () => {
    const actor = await rentalActor('create');
    if (input.who.kind !== 'WALK_IN') throw new FormError('Enter the customer for this booking.');
    const booking = await createBooking(input, actor);
    id = booking.id;
    if (payment && payment.amount > 0) {
      const payActor: Actor = await rentalActor('payOffline');
      await recordOfflinePayment(booking.id, payment, payActor);
    }
    done();
    return `Booking ${booking.code} created`;
  });
  return { ...result, id };
}

export async function approveBookingAction(id: string) {
  return run(async () => {
    const actor = await rentalActor('manage');
    const status = await approveBooking(id, actor);
    done();
    return status === 'CONFIRMED' ? 'Booking approved and confirmed' : 'Booking approved. It now waits for the payment.';
  });
}

export async function rejectBookingAction(id: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('manage');
    await rejectBooking(id, text(fd, 'reason', { label: 'Reason', max: 200 }), actor);
    done();
    return 'Booking rejected and the slot released';
  });
}

export async function cancelBookingAction(id: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('manage');
    const result = await cancelBooking(id, actor, { byCustomer: false, reason: text(fd, 'reason', { label: 'Reason', max: 300 }), waiveCharge: checked(fd, 'waiveCharge') });
    done();
    return ['Booking cancelled.', result.charge > 0 ? `Cancellation charge ₹${result.charge}.` : '', result.refund > 0 ? `₹${result.refund} is due as a refund.` : ''].filter(Boolean).join(' ');
  });
}

export async function rescheduleBookingAction(id: string, change: { date: string; startMin: number | null; resourceId: string | null }) {
  return run(async () => {
    const actor = await rentalActor('manage');
    await rescheduleBooking(id, change, actor, { byCustomer: false });
    done();
    return 'Booking rescheduled';
  });
}

/** Check-in is a receptionist's job; starting, completing and no-show are for managers. */
export async function moveBookingAction(id: string, to: 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW') {
  return run(async () => {
    const actor = await rentalActor(to === 'CHECKED_IN' ? 'checkin' : 'manage');
    await moveBooking(id, to, actor);
    done();
    return { CHECKED_IN: 'Customer checked in', IN_PROGRESS: 'Session started', COMPLETED: 'Rental completed', NO_SHOW: 'Marked as a no-show; the slot is free again' }[to];
  });
}

export async function editBookingAction(id: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('manage');
    await updateBookingDetails(id, {
      notes: text(fd, 'notes', { label: 'Customer note', max: 500 }),
      staffNotes: text(fd, 'staffNotes', { label: 'Staff note', max: 1000 }),
      players: int(fd, 'players', { label: 'Players', min: 1, max: 200 }),
    }, actor);
    done();
    return 'Booking details saved';
  });
}

// ---------------------------------------------------------------------------
// Payments and refunds
// ---------------------------------------------------------------------------

export async function recordPaymentAction(bookingId: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('payOffline');
    const result = await recordOfflinePayment(bookingId, {
      amount: int(fd, 'amount', { required: true, label: 'Amount', min: 1, max: 10_000_000 })!,
      method: text(fd, 'method', { required: true, label: 'Method' }),
      reference: text(fd, 'reference', { label: 'Reference', max: 80 }),
    }, actor);
    done();
    return `Payment recorded. Receipt ${result.receiptNo}.${result.confirmed ? ' The booking is now confirmed.' : ''}`;
  });
}

export async function createRefundAction(bookingId: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('refund');
    await createRefund(bookingId, { amount: int(fd, 'amount', { required: true, label: 'Amount', min: 1, max: 10_000_000 })!, reason: text(fd, 'reason', { label: 'Reason', max: 200 }) }, actor);
    done();
    return 'Refund added to the list of refunds to pay';
  });
}

export async function processRefundAction(refundId: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('refund');
    const method = text(fd, 'method', { required: true, label: 'Method' });
    const result = method === 'GATEWAY' ? await refundViaGateway(refundId, actor) : await processRefund(refundId, { method, reference: text(fd, 'reference', { label: 'Reference', max: 80 }) }, actor);
    done();
    return `₹${result.amount} refunded`;
  });
}

export async function declineRefundAction(refundId: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('refund');
    await declineRefund(refundId, text(fd, 'note', { label: 'Note', max: 80 }), actor);
    done();
    return 'Refund declined';
  });
}

// ---------------------------------------------------------------------------
// Customers and settings
// ---------------------------------------------------------------------------

export async function setCustomerActive(id: string, active: boolean) {
  return run(async () => {
    const actor = await rentalActor('config');
    const customer = await db.rentalCustomer.update({ where: { id }, data: { active, sessionVersion: { increment: 1 } } });
    await audit(db, { entity: 'CUSTOMER', entityId: id, action: active ? 'Customer account switched on' : 'Customer account switched off', detail: customer.name, actor });
    done();
    return active ? `${customer.name} can book again` : `${customer.name}'s account is switched off`;
  });
}

export async function resetCustomerPassword(id: string, fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const password = String(fd.get('password') ?? '');
    if (password.length < 8 || password.length > 100) throw new FormError('The password must be at least 8 characters.');
    const customer = await db.rentalCustomer.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10), sessionVersion: { increment: 1 } } });
    await audit(db, { entity: 'CUSTOMER', entityId: id, action: 'Customer password reset', detail: customer.name, actor });
    return `New password set for ${customer.name}. Tell them privately.`;
  });
}

export async function saveRentalSettingsAction(fd: FormData) {
  return run(async () => {
    const actor = await rentalActor('config');
    const n = (key: keyof typeof DEFAULT_RENTAL_SETTINGS, label: string, min: number, max: number) => int(fd, key, { required: true, label, min, max })!;
    const upiId = text(fd, 'upiId', { label: 'UPI ID', max: 60 }) ?? '';
    if (upiId && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) throw new FormError('Enter a UPI ID like name@bank, or leave it empty.');
    const values = {
      holdMinutes: n('holdMinutes', 'Online hold', 5, 120),
      offlineHoldHours: n('offlineHoldHours', 'Offline hold', 0, 168),
      advancePercent: n('advancePercent', 'Advance', 0, 100),
      bookingWindowDays: n('bookingWindowDays', 'Booking window', 1, 365),
      minLeadMinutes: n('minLeadMinutes', 'Shortest notice', 0, 1440),
      rescheduleCutoffHours: n('rescheduleCutoffHours', 'Reschedule cut-off', 0, 168),
      maxReschedules: n('maxReschedules', 'Reschedules allowed', 0, 20),
      reminderHours: n('reminderHours', 'Reminder', 0, 168),
      allowPayAtVenue: checked(fd, 'allowPayAtVenue'),
      upiId,
      upiName: text(fd, 'upiName', { label: 'UPI name', max: 60 }) ?? '',
      receiptPrefix: (text(fd, 'receiptPrefix', { required: true, label: 'Receipt prefix', max: 10 })).toUpperCase(),
    };
    if (!/^[A-Z0-9-]+$/.test(values.receiptPrefix)) throw new FormError('The receipt prefix can only use letters, numbers and hyphens.');
    await saveRentalSettings(values);
    await audit(db, { entity: 'SETTINGS', action: 'Booking settings changed', detail: values, actor });
    done();
    return 'Booking settings saved';
  });
}

/** Free start times when moving a booking: its own slots count as free. */
export async function staffRescheduleSlots(bookingId: string, day: string) {
  await rentalActor('manage');
  const b = await db.rentalBooking.findUnique({ where: { id: bookingId }, select: { facilityId: true, packageId: true } });
  if (!b) return null;
  return customerSlots(b.facilityId, day, b.packageId, { staff: true, excludeBookingId: bookingId });
}
