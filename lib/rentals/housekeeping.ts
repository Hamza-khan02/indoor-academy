// Background chores for bookings: release unpaid holds that ran out, send booking reminders and
// equipment return reminders. There is no separate worker: this runs (at most once a minute)
// when booking pages are opened, and can also be called on a schedule through
// /api/rentals/housekeeping. Availability never depends on it: every booking transaction
// releases expired holds itself before checking what is free.
import { db } from '../db';
import { releaseExpired } from './booking';
import { rentalTx } from './core';
import { notifyBooking } from './notify';
import { getRentalSettings } from './settings';
import { instantOf, nowIST } from './time';

let lastRun = 0;

export async function runHousekeeping(force = false) {
  if (!force && Date.now() - lastRun < 60_000) return null;
  lastRun = Date.now();
  const now = new Date();
  const today = nowIST(now);
  const settings = await getRentalSettings();

  // 1. Unpaid holds whose time is up.
  const stale = await db.rentalBooking.count({ where: { status: { in: ['PENDING', 'PAYMENT_PENDING'] }, expiresAt: { lt: now } } });
  if (stale > 0) await rentalTx((tx) => releaseExpired(tx, now));
  const expired = await db.rentalBooking.findMany({
    where: { status: 'EXPIRED', updatedAt: { gte: new Date(now.getTime() - 2 * 86_400_000) }, notifications: { none: { type: 'EXPIRED' } } },
    select: { id: true },
  });
  for (const b of expired) await notifyBooking(b.id, 'EXPIRED', { dedupeKey: `EXPIRED:${b.id}` });

  // 2. Reminders for confirmed bookings that start soon.
  let reminders = 0;
  if (settings.reminderHours > 0) {
    const until = new Date(now.getTime() + settings.reminderHours * 3_600_000);
    const soon = await db.rentalBooking.findMany({
      where: { status: 'CONFIRMED', date: { gte: today.date, lte: nowIST(until).date } },
      select: { id: true, date: true, startMin: true, createdAt: true },
    });
    for (const b of soon) {
      const start = instantOf(b.date, b.startMin);
      if (start <= now || start > until) continue;
      if (now.getTime() - b.createdAt.getTime() < 3_600_000) continue; // just booked: the confirmation is reminder enough for now
      await notifyBooking(b.id, 'REMINDER', { dedupeKey: `REMINDER:${b.id}:${b.date}:${b.startMin}` });
      reminders++;
    }
  }

  // 3. Equipment that is out past its due day: one reminder a day.
  const overdue = await db.bookingEquipment.findMany({
    where: { status: 'ISSUED', dueDate: { lt: today.date } },
    select: { bookingId: true },
    distinct: ['bookingId'],
  });
  for (const line of overdue) await notifyBooking(line.bookingId, 'RETURN_REMINDER', { dedupeKey: `RETURN:${line.bookingId}:${today.date}` });

  return { expired: expired.length, reminders, returnReminders: overdue.length };
}
