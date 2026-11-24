// Customer notifications for bookings: saved for the customer's booking account (in-app) and
// emailed when an email address is known and SMTP is set up. Staff can also send the same text
// on WhatsApp with a wa.me link (the app's existing WhatsApp approach); a WhatsApp API can be
// plugged in later inside `deliver`.
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '../db';
import { formatDate } from '../dates';
import { inr } from '../format';
import { NOTIFICATION_TYPES } from './constants';
import { amountDue } from './core';
import { emailConfig } from './settings';
import { rangeLabel } from './time';

type Extra = { amount?: number; note?: string | null; dedupeKey?: string };

async function loadBooking(bookingId: string) {
  return db.rentalBooking.findUnique({
    where: { id: bookingId },
    include: {
      facility: { select: { name: true, category: true } },
      package: { select: { name: true } },
      resources: { include: { resource: { select: { name: true } } } },
      equipment: { include: { item: { select: { name: true } } } },
    },
  });
}
type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

/** "Indoor nets (Net 1) on 25 Nov 2026, 06:00 PM – 07:00 PM" */
export function bookingWhen(b: Pick<LoadedBooking, 'kind' | 'date' | 'startMin' | 'endMin' | 'returnDate'>) {
  if (b.kind === 'EQUIPMENT') return b.returnDate && b.returnDate !== b.date ? `${formatDate(b.date)} to ${formatDate(b.returnDate)}` : formatDate(b.date);
  return `${formatDate(b.date)}, ${rangeLabel(b.startMin, b.endMin)}`;
}

function describe(b: LoadedBooking) {
  const units = b.resources.map((r) => r.resource.name).join(' + ');
  const what = [b.facility.name, b.package?.name, units ? `(${units})` : ''].filter(Boolean).join(' ');
  const items = b.equipment.filter((e) => e.status !== 'RELEASED').map((e) => `${e.item.name} × ${e.qty}`).join(', ');
  return `${what} on ${bookingWhen(b)}${items ? `. Equipment: ${items}` : ''}`;
}

/** The title and text of a notification. Also used for the WhatsApp message staff can send. */
export function composeMessage(b: LoadedBooking, type: string, academy: string, extra: Extra = {}) {
  const due = amountDue(b);
  const dueText = due > 0 ? ` Amount still to pay: ${inr(due)}.` : '';
  const ref = `Booking ID ${b.code}`;
  const what = describe(b);
  const note = extra.note ? ` ${extra.note}` : '';
  const texts: Record<string, [string, string]> = {
    BOOKING_RECEIVED: [
      b.status === 'PENDING' ? 'Booking request received' : 'Booking held: payment pending',
      b.status === 'PENDING'
        ? `We have received your request for ${what}. ${ref}. The academy will approve it shortly.`
        : `Your slot for ${what} is held. ${ref}. Pay ${inr(due)} to confirm it${b.expiresAt ? ` before ${b.expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}` : ''}, or the hold is released.`,
    ],
    BOOKING_CONFIRMED: ['Booking confirmed', `Your booking is confirmed: ${what}. ${ref}.${dueText}`],
    PAYMENT: ['Payment received', `We received ${inr(extra.amount ?? 0)} for ${what}. ${ref}.${dueText || ' Paid in full.'}`],
    REMINDER: ['Booking reminder', `Reminder: ${what}. ${ref}.${dueText} Please arrive 10 minutes early.`],
    CANCELLED: ['Booking cancelled', `Your booking was cancelled: ${what}. ${ref}.${note}`],
    RESCHEDULED: ['Booking rescheduled', `Your booking has moved. New time: ${what}. ${ref}.${dueText}`],
    RETURN_REMINDER: ['Please return the equipment', `The equipment rented on booking ${b.code} is due back.${note} Please return it to the academy.`],
    REFUND: ['Refund processed', `${inr(extra.amount ?? 0)} has been refunded for booking ${b.code}.${note}`],
    REJECTED: ['Booking not approved', `Sorry, your request for ${what} could not be approved. ${ref}.${note}`],
    EXPIRED: ['Booking expired', `The hold on ${what} ran out before payment, so the slot was released. ${ref}. You are welcome to book again.`],
  };
  const [title, text] = texts[type] ?? [NOTIFICATION_TYPES[type] ?? 'Booking update', `${what}. ${ref}.${note}`];
  return { title, body: `${text}\n\n${academy}` };
}

async function academyName() {
  const row = await db.setting.findUnique({ where: { key: 'academyName' } });
  return row?.value || 'INDOOR ACADEMY';
}

let transport: { key: string; mailer: Transporter } | null = null;

/** Sends one email. Returns the status stored on the notification. */
export async function sendEmail(to: string, subject: string, text: string): Promise<{ status: 'SENT' | 'FAILED' | 'NOT_CONFIGURED'; error?: string }> {
  const cfg = emailConfig();
  if (!cfg) return { status: 'NOT_CONFIGURED' };
  try {
    const key = JSON.stringify([cfg.host, cfg.port, cfg.secure, cfg.user]);
    if (!transport || transport.key !== key) {
      transport = {
        key,
        mailer: nodemailer.createTransport({
          host: cfg.host, port: cfg.port, secure: cfg.secure,
          auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
          connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
        }),
      };
    }
    await transport.mailer.sendMail({ from: cfg.from, to, subject, text });
    return { status: 'SENT' };
  } catch (e: any) {
    return { status: 'FAILED', error: String(e?.message ?? e).slice(0, 300) };
  }
}

/**
 * Tells the customer about something that happened to their booking. Never throws: a failed
 * notification must not undo or block the booking itself.
 */
export async function notifyBooking(bookingId: string, type: string, extra: Extra = {}) {
  try {
    const b = await loadBooking(bookingId);
    if (!b) return;
    const { title, body } = composeMessage(b, type, await academyName(), extra);
    let created;
    try {
      created = await db.rentalNotification.create({
        data: {
          type, title, body, dedupeKey: extra.dedupeKey ?? null, bookingId: b.id,
          customerId: b.customerId, familyLoginId: b.familyLoginId,
          emailTo: b.customerEmail, emailStatus: b.customerEmail ? 'NOT_CONFIGURED' : 'NONE',
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return; // already sent (reminders)
      throw e;
    }
    if (b.customerEmail) {
      const sent = await sendEmail(b.customerEmail, `${title} · ${b.code}`, body);
      await db.rentalNotification.update({ where: { id: created.id }, data: { emailStatus: sent.status, emailError: sent.error ?? null } });
    }
  } catch (e) {
    console.error('Booking notification failed', e);
  }
}

/** The text staff can send on WhatsApp for a booking (same wording as the notification). */
export async function whatsappText(bookingId: string, type: string) {
  const b = await loadBooking(bookingId);
  if (!b) return null;
  const { title, body } = composeMessage(b, type, await academyName());
  return `*${title}*\n${body}`;
}
