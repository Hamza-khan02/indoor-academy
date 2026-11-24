// Equipment inventory: how many items are free, and the hand-over workflow
// Reserved -> Issued -> Returned -> Inspected (back in stock).
import { db } from '../db';
import { FormError } from '../form';
import { HOLDING } from './constants';
import { type Actor, type Tx, audit, rentalTx } from './core';
import type { PriceLine } from './pricing';
import { nowIST, overlaps } from './time';

export type EquipmentWindow = { date: string; startMin: number; endMin: number; returnDate: string | null };

const lastDay = (w: EquipmentWindow) => (w.returnDate && w.returnDate > w.date ? w.returnDate : w.date);

/** Do two rentals need the same item at the same time? */
function windowsClash(a: EquipmentWindow, b: EquipmentWindow) {
  if (lastDay(a) < b.date || lastDay(b) < a.date) return false;
  if (lastDay(a) === a.date && lastDay(b) === b.date) return overlaps(a.startMin, a.endMin, b.startMin, b.endMin);
  return true;
}

/**
 * Items free for a rental window: usable stock, minus what other live bookings have reserved for
 * an overlapping time, minus anything that is out and overdue (not back in stock until inspected).
 */
export async function equipmentFree(tx: Tx | typeof db, itemIds: string[], window: EquipmentWindow, excludeBookingId?: string) {
  const free = new Map<string, number>();
  if (itemIds.length === 0) return free;
  const now = new Date();
  const today = nowIST(now);
  const [items, lines] = await Promise.all([
    tx.equipmentItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, totalQty: true, damagedQty: true } }),
    tx.bookingEquipment.findMany({
      where: {
        itemId: { in: itemIds },
        status: { in: ['RESERVED', 'ISSUED', 'RETURNED'] },
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        booking: { NOT: { status: { in: ['PENDING', 'PAYMENT_PENDING'] }, expiresAt: { lt: now } } },
      },
      select: { itemId: true, qty: true, status: true, booking: { select: { date: true, startMin: true, endMin: true, returnDate: true } } },
    }),
  ]);
  const used = new Map<string, number>();
  for (const line of lines) {
    const w = line.booking;
    const out = line.status !== 'RESERVED';
    const overdue = out && (lastDay(w) < today.date || (lastDay(w) === today.date && w.endMin <= today.minutes));
    if (overdue || windowsClash(w, window)) used.set(line.itemId, (used.get(line.itemId) ?? 0) + line.qty);
  }
  for (const item of items) free.set(item.id, Math.max(0, item.totalQty - item.damagedQty - (used.get(item.id) ?? 0)));
  return free;
}

/** Stock picture for the inventory page: total, reserved, rented, waiting for inspection, damaged and available now. */
export async function inventory() {
  const now = new Date();
  const [items, lines] = await Promise.all([
    db.equipmentItem.findMany({ orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }] }),
    db.bookingEquipment.groupBy({
      by: ['itemId', 'status'],
      where: {
        status: { in: ['RESERVED', 'ISSUED', 'RETURNED'] },
        booking: { status: { in: HOLDING }, NOT: { status: { in: ['PENDING', 'PAYMENT_PENDING'] }, expiresAt: { lt: now } } },
      },
      _sum: { qty: true },
    }),
  ]);
  const sum = (itemId: string, status: string) => lines.find((l) => l.itemId === itemId && l.status === status)?._sum.qty ?? 0;
  return items.map((item) => {
    const reserved = sum(item.id, 'RESERVED');
    const rented = sum(item.id, 'ISSUED');
    const toInspect = sum(item.id, 'RETURNED');
    return { ...item, reserved, rented, toInspect, available: Math.max(0, item.totalQty - item.damagedQty - reserved - rented - toInspect) };
  });
}

async function lineForUpdate(tx: Tx, lineId: string) {
  const line = await tx.bookingEquipment.findUnique({ where: { id: lineId }, include: { item: true, booking: true } });
  if (!line) throw new FormError('This equipment line no longer exists.');
  return line;
}

const move = (tx: Tx, itemId: string, bookingId: string | null, type: string, qty: number, actor: Actor, note?: string | null) =>
  tx.equipmentMovement.create({ data: { itemId, bookingId, type, qty, actor: actor.name, note: note ?? null } });

/** Hand the reserved items to the customer. */
export async function issueLine(lineId: string, actor: Actor) {
  return rentalTx(async (tx) => {
    const line = await lineForUpdate(tx, lineId);
    if (line.status !== 'RESERVED') throw new FormError('These items are not waiting to be issued.');
    if (!['CHECKED_IN', 'IN_PROGRESS'].includes(line.booking.status)) throw new FormError('Check the customer in before handing over equipment.');
    await tx.bookingEquipment.update({ where: { id: lineId }, data: { status: 'ISSUED', issuedAt: new Date(), dueDate: line.booking.returnDate ?? line.booking.date } });
    await move(tx, line.itemId, line.bookingId, 'ISSUED', line.qty, actor);
    await audit(tx, { bookingId: line.bookingId, entity: 'EQUIPMENT', entityId: line.itemId, action: 'Equipment issued', detail: `${line.item.name} × ${line.qty}`, actor });
    return `${line.item.name} × ${line.qty} issued`;
  });
}

/** The customer has brought the items back; they wait for inspection. */
export async function returnLine(lineId: string, actor: Actor) {
  return rentalTx(async (tx) => {
    const line = await lineForUpdate(tx, lineId);
    if (line.status !== 'ISSUED') throw new FormError('These items are not out with the customer.');
    await tx.bookingEquipment.update({ where: { id: lineId }, data: { status: 'RETURNED', returnedAt: new Date() } });
    await move(tx, line.itemId, line.bookingId, 'RETURNED', line.qty, actor);
    await audit(tx, { bookingId: line.bookingId, entity: 'EQUIPMENT', entityId: line.itemId, action: 'Equipment returned', detail: `${line.item.name} × ${line.qty}`, actor });
    return `${line.item.name} returned. Inspect it to put it back in stock.`;
  });
}

/** Inspection: good items go back in stock; damaged ones are taken out of service; missing ones leave the stock count. */
export async function inspectLine(lineId: string, result: { damagedQty: number; missingQty: number; charge: number; note: string | null }, actor: Actor) {
  return rentalTx(async (tx) => {
    const line = await lineForUpdate(tx, lineId);
    if (line.status !== 'RETURNED') throw new FormError('Record the return before inspecting.');
    const { damagedQty, missingQty, charge, note } = result;
    if (damagedQty < 0 || missingQty < 0 || damagedQty + missingQty > line.qty) throw new FormError(`Damaged and missing together cannot be more than the ${line.qty} rented.`);
    if (charge < 0) throw new FormError('The charge cannot be negative.');
    if (charge > 0 && damagedQty + missingQty === 0) throw new FormError('Enter how many items were damaged or missing for this charge.');

    await tx.bookingEquipment.update({ where: { id: lineId }, data: { status: 'INSPECTED', inspectedAt: new Date(), damagedQty, missingQty, charge, note } });
    if (damagedQty > 0 || missingQty > 0) {
      await tx.equipmentItem.update({ where: { id: line.itemId }, data: { damagedQty: { increment: damagedQty }, totalQty: { decrement: missingQty } } });
    }
    await move(tx, line.itemId, line.bookingId, 'INSPECTED', line.qty - damagedQty - missingQty, actor, note);
    if (damagedQty > 0) await move(tx, line.itemId, line.bookingId, 'DAMAGED', damagedQty, actor, note);
    if (missingQty > 0) await move(tx, line.itemId, line.bookingId, 'MISSING', missingQty, actor, note);
    if (charge > 0) {
      const lines = JSON.parse(line.booking.priceLines || '[]') as PriceLine[];
      const what = [damagedQty ? `${damagedQty} damaged` : '', missingQty ? `${missingQty} missing` : ''].filter(Boolean).join(', ');
      lines.push({ kind: 'CHARGE', label: `${line.item.name}: ${what}`, amount: charge });
      await tx.rentalBooking.update({
        where: { id: line.bookingId },
        data: { extraCharges: { increment: charge }, total: { increment: charge }, priceLines: JSON.stringify(lines) },
      });
    }
    await audit(tx, {
      bookingId: line.bookingId, entity: 'EQUIPMENT', entityId: line.itemId, action: 'Equipment inspected',
      detail: { item: line.item.name, qty: line.qty, damagedQty, missingQty, charge, note }, actor,
    });
    return charge > 0 ? `Inspection saved. ₹${charge} added to the booking.` : 'Inspection saved. Items are back in stock.';
  });
}

/** Stock corrections made by an administrator, each with a movement record. */
export async function adjustStock(itemId: string, change: { type: 'ADJUSTED' | 'REPAIRED' | 'WRITTEN_OFF'; qty: number; note: string | null }, actor: Actor) {
  return rentalTx(async (tx) => {
    const item = await tx.equipmentItem.findUnique({ where: { id: itemId } });
    if (!item) throw new FormError('This item no longer exists.');
    const { type, qty, note } = change;
    if (type === 'ADJUSTED') {
      if (item.totalQty + qty < item.damagedQty) throw new FormError('The total cannot go below the number marked damaged.');
      const out = await tx.bookingEquipment.aggregate({ where: { itemId, status: { in: ['RESERVED', 'ISSUED', 'RETURNED'] }, booking: { status: { in: HOLDING } } }, _sum: { qty: true } });
      if (item.totalQty + qty - item.damagedQty < (out._sum.qty ?? 0)) throw new FormError(`${out._sum.qty} of these are reserved or out with customers. The total cannot go below that.`);
      await tx.equipmentItem.update({ where: { id: itemId }, data: { totalQty: { increment: qty } } });
    } else {
      if (qty <= 0 || qty > item.damagedQty) throw new FormError(`Enter a number from 1 to ${item.damagedQty} (the items marked damaged).`);
      await tx.equipmentItem.update({
        where: { id: itemId },
        data: type === 'REPAIRED' ? { damagedQty: { decrement: qty } } : { damagedQty: { decrement: qty }, totalQty: { decrement: qty } },
      });
    }
    await move(tx, itemId, null, type === 'WRITTEN_OFF' ? 'ADJUSTED' : type, type === 'WRITTEN_OFF' ? -qty : qty, actor, type === 'WRITTEN_OFF' ? `Written off. ${note ?? ''}`.trim() : note);
    await audit(tx, { entity: 'EQUIPMENT', entityId: itemId, action: `Stock ${type.toLowerCase().replace('_', ' ')}`, detail: { item: item.name, qty, note }, actor });
    return 'Stock updated';
  });
}
