// Read-only availability for the booking form and the staff calendar. These views are a guide:
// the booking itself is always re-checked on the server inside the reserving transaction.
import { db } from '../db';
import { addDays } from '../dates';
import { HOLDING, slotState } from './constants';
import { getRentalSettings } from './settings';
import { nowIST, overlaps, slotStarts } from './time';

export type CellState = 'AVAILABLE' | 'BOOKED' | 'PENDING' | 'CHECKED_IN' | 'BLOCKED' | 'PAST';
export type Cell = {
  state: CellState;
  booking?: { id: string; code: string; name: string; status: string; startMin: number; endMin: number };
  reason?: string;
};
type Busy = { startMin: number; endMin: number; state: CellState; booking?: Cell['booking']; reason?: string };

/** Bookings whose unpaid hold has run out no longer block anything, even before they are cleaned up. */
const notExpired = (now: Date) => ({ NOT: { status: { in: ['PENDING', 'PAYMENT_PENDING'] }, expiresAt: { lt: now } } });

/** What is busy on one day, per unit, for the given facilities. */
async function occupancy(facilityIds: string[], date: string, excludeBookingId?: string) {
  const now = new Date();
  const [facilities, bookings, blockouts] = await Promise.all([
    db.rentalFacility.findMany({ where: { id: { in: facilityIds } }, include: { resources: { where: { status: { not: 'INACTIVE' } } } } }),
    db.rentalBooking.findMany({
      where: { date, status: { in: [...HOLDING, 'COMPLETED'] }, resources: { some: { resource: { facilityId: { in: facilityIds } } } }, ...notExpired(now), ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}) },
      select: { id: true, code: true, customerName: true, status: true, startMin: true, endMin: true, resources: { select: { resourceId: true } } },
    }),
    db.facilityBlockout.findMany({ where: { facilityId: { in: facilityIds }, fromDate: { lte: date }, toDate: { gte: date } } }),
  ]);
  const busy = new Map<string, Busy[]>();
  const add = (resourceId: string, b: Busy) => busy.set(resourceId, [...(busy.get(resourceId) ?? []), b]);
  for (const f of facilities) {
    for (const r of f.resources) {
      const down = f.status !== 'ACTIVE' ? f.maintenanceNote || (f.status === 'MAINTENANCE' ? 'Under maintenance' : 'Switched off') : r.status !== 'ACTIVE' ? r.maintenanceNote || 'Under maintenance' : null;
      if (down) add(r.id, { startMin: 0, endMin: 1440, state: 'BLOCKED', reason: down });
    }
    for (const blk of blockouts.filter((b) => b.facilityId === f.id)) {
      const entry: Busy = { startMin: blk.startMin ?? 0, endMin: blk.endMin ?? 1440, state: 'BLOCKED', reason: blk.reason || (blk.kind === 'MAINTENANCE' ? 'Maintenance' : 'Blocked') };
      for (const r of f.resources) if (!blk.resourceId || blk.resourceId === r.id) add(r.id, entry);
    }
  }
  for (const b of bookings) {
    const entry: Busy = {
      startMin: b.startMin, endMin: b.endMin, state: b.status === 'COMPLETED' ? 'BOOKED' : (slotState(b.status) as CellState),
      booking: { id: b.id, code: b.code, name: b.customerName, status: b.status, startMin: b.startMin, endMin: b.endMin },
    };
    for (const r of b.resources) add(r.resourceId, entry);
  }
  return { facilities, busy };
}

const firstBusy = (list: Busy[] | undefined, startMin: number, endMin: number) => {
  const hits = (list ?? []).filter((b) => overlaps(b.startMin, b.endMin, startMin, endMin));
  // A booking is more informative than a blockout when both cover a slot.
  return hits.find((h) => h.booking) ?? hits[0];
};

/** The staff calendar's day view of one facility: a cell per unit and slot. */
export async function dayGrid(facilityId: string, date: string) {
  const { facilities, busy } = await occupancy([facilityId], date);
  const facility = facilities[0];
  if (!facility) return null;
  const today = nowIST();
  const starts = slotStarts(facility.openTime, facility.closeTime, facility.slotMinutes);
  const resources = [...facility.resources].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const cells: Record<string, Record<number, Cell>> = {};
  for (const r of resources) {
    cells[r.id] = {};
    for (const t of starts) {
      const hit = firstBusy(busy.get(r.id), t, t + facility.slotMinutes);
      const past = date < today.date || (date === today.date && t + facility.slotMinutes <= today.minutes);
      cells[r.id][t] = hit ? { state: hit.state, booking: hit.booking, reason: hit.reason } : { state: past ? 'PAST' : 'AVAILABLE' };
    }
  }
  return { facility, resources, starts, cells };
}

export type CustomerSlot = { startMin: number; free: boolean; maxSlots: number; left: number };

/**
 * The start times a customer can pick on a day, and how long a booking can run from each.
 * With a "machine + net" package a start is offered only when a machine and a net are both free.
 */
export async function customerSlots(facilityId: string, date: string, packageId?: string | null, opts: { staff?: boolean; excludeBookingId?: string } = {}) {
  const [settings, pkg] = await Promise.all([
    getRentalSettings(),
    packageId ? db.rentalPackage.findUnique({ where: { id: packageId }, select: { facilityId: true, includesNet: true, netFacilityId: true, active: true } }) : null,
  ]);
  const netFacilityId = pkg && pkg.facilityId === facilityId && pkg.includesNet ? pkg.netFacilityId : null;
  // When rescheduling, the booking's own slots count as free.
  const { facilities, busy } = await occupancy(netFacilityId ? [facilityId, netFacilityId] : [facilityId], date, opts.excludeBookingId);
  const facility = facilities.find((f) => f.id === facilityId);
  if (!facility) return null;
  const nets = netFacilityId ? facilities.find((f) => f.id === netFacilityId) ?? null : null;
  const today = nowIST();
  const lastDay = addDays(today.date, settings.bookingWindowDays);
  const dayOpen = facility.status === 'ACTIVE' && date >= today.date && (opts.staff || date <= lastDay) && (!netFacilityId || nets?.status === 'ACTIVE');
  const earliest = date === today.date ? today.minutes + (opts.staff ? -1440 : settings.minLeadMinutes) : -1;
  const slot = facility.slotMinutes;

  // Longest run of free slots from `t` on any single unit of a facility.
  const run = (f: typeof facility, t: number) => {
    let best = 0;
    for (const r of f.resources) {
      if (r.status !== 'ACTIVE') continue;
      let n = 0;
      while (n < facility.maxSlots && t + (n + 1) * slot <= f.closeTime && t >= f.openTime && !firstBusy(busy.get(r.id), t + n * slot, t + (n + 1) * slot)) n++;
      best = Math.max(best, n);
    }
    return best;
  };
  const freeUnits = (f: typeof facility, t: number) => f.resources.filter((r) => r.status === 'ACTIVE' && !firstBusy(busy.get(r.id), t, t + slot)).length;

  const slots: CustomerSlot[] = slotStarts(facility.openTime, facility.closeTime, slot).map((t) => {
    const open = dayOpen && t >= earliest;
    const maxSlots = open ? Math.min(run(facility, t), nets ? run(nets, t) : Infinity) : 0;
    return { startMin: t, free: maxSlots > 0, maxSlots, left: open ? Math.min(freeUnits(facility, t), nets ? freeUnits(nets, t) : Infinity) : 0 };
  });
  // A whole-day facility is one "slot": free when a unit has nothing at all on that day.
  const wholeDayFree = dayOpen && facility.resources.some((r) => r.status === 'ACTIVE' && !firstBusy(busy.get(r.id), facility.openTime, facility.closeTime))
    && (date > today.date || today.minutes < facility.closeTime);
  return { slots, wholeDayFree, dayOpen, lastDay, today: today.date };
}

/** Bookings and blockouts in a date range, for the calendar's week and month views. */
export async function rangeBookings(from: string, to: string, facilityId?: string | null) {
  const now = new Date();
  const [bookings, blockouts] = await Promise.all([
    db.rentalBooking.findMany({
      where: {
        date: { gte: from, lte: to }, status: { in: [...HOLDING, 'COMPLETED'] }, ...notExpired(now),
        ...(facilityId ? { OR: [{ facilityId }, { resources: { some: { resource: { facilityId } } } }] } : {}),
      },
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      select: {
        id: true, code: true, customerName: true, status: true, date: true, startMin: true, endMin: true, kind: true,
        facility: { select: { id: true, name: true } }, resources: { select: { resource: { select: { name: true } } } },
      },
    }),
    db.facilityBlockout.findMany({
      where: { fromDate: { lte: to }, toDate: { gte: from }, ...(facilityId ? { facilityId } : {}) },
      include: { facility: { select: { name: true } }, resource: { select: { name: true } } },
    }),
  ]);
  return { bookings, blockouts };
}
