// Money for bookings: offline payments entered by staff, online payments through Razorpay
// (confirmed only after the server has verified Razorpay's signature), refunds and receipt numbers.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../db';
import { FormError } from '../form';
import { financialYear, formatReceiptNo } from '../receipts';
import { BOOKING_STATUS, OFFLINE_METHODS, RELEASING, canTransition } from './constants';
import { applyStatus } from './booking';
import { type Actor, type Tx, advanceDue, amountDue, audit, rentalTx } from './core';
import { notifyBooking } from './notify';
import { type RentalSettings, gatewayConfig, getRentalSettings } from './settings';
import { nowIST } from './time';

const GATEWAY: Actor = { type: 'GATEWAY', name: 'Razorpay' };
const DEAD = [...RELEASING, 'REFUNDED'];
const label = (status: string) => BOOKING_STATUS[status]?.label ?? status;

/** Next receipt number for booking payments, e.g. IAR/2026-27/0001. Numbered per financial year, never reused. */
async function takeReceiptNo(tx: Tx, prefix: string) {
  const fy = financialYear(nowIST().date);
  const key = `rental.receiptSeq:${fy}`;
  const rows = await tx.$queryRaw<{ value: string }[]>`
    INSERT INTO "Setting" ("key", "value") VALUES (${key}, '1')
    ON CONFLICT ("key") DO UPDATE SET "value" = CAST(CAST("Setting"."value" AS INTEGER) + 1 AS TEXT)
    RETURNING "value"`;
  return formatReceiptNo(prefix || 'IAR', fy, Number(rows[0].value));
}

/** Adds received money to the booking, and confirms a booking that was only waiting for its payment. */
async function credit(tx: Tx, bookingId: string, amount: number, settings: RentalSettings, actor: Actor) {
  const b = await tx.rentalBooking.update({ where: { id: bookingId }, data: { paid: { increment: amount } } });
  if (b.status === 'PAYMENT_PENDING' && advanceDue(b, settings.advancePercent) === 0) {
    await applyStatus(tx, b.id, 'CONFIRMED', actor, { note: 'Payment received' });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Offline payments (cash, UPI QR, card machine, bank transfer), entered by authorised staff
// ---------------------------------------------------------------------------

export async function recordOfflinePayment(bookingId: string, input: { amount: number; method: string; reference?: string | null }, actor: Actor) {
  const settings = await getRentalSettings();
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) throw new FormError('Enter the amount received in whole rupees.');
  if (!(input.method in OFFLINE_METHODS)) throw new FormError('Choose how the payment was made.');
  const reference = input.reference?.trim().slice(0, 80) || null;

  const result = await rentalTx(async (tx) => {
    const b = await tx.rentalBooking.findUnique({ where: { id: bookingId } });
    if (!b) throw new FormError('This booking no longer exists.');
    if (DEAD.includes(b.status)) throw new FormError(`This booking is "${label(b.status)}". A payment cannot be added to it.`);
    if (b.status === 'PENDING') throw new FormError('Approve the booking before taking a payment.');
    const due = amountDue(b);
    if (due <= 0) throw new FormError('This booking is already paid in full.');
    if (amount > due) throw new FormError(`Only ₹${due} is still to pay on this booking.`);
    const receiptNo = await takeReceiptNo(tx, settings.receiptPrefix);
    const payment = await tx.rentalPayment.create({
      data: { bookingId, amount, method: input.method, status: 'PAID', reference, receiptNo, recordedBy: actor.name, paidAt: new Date() },
    });
    const confirmed = await credit(tx, bookingId, amount, settings, actor);
    await audit(tx, { bookingId, entity: 'PAYMENT', entityId: payment.id, action: 'Offline payment recorded', detail: { amount, method: input.method, reference, receiptNo }, actor });
    return { paymentId: payment.id, receiptNo, confirmed };
  });
  await notifyBooking(bookingId, 'PAYMENT', { amount });
  if (result.confirmed) await notifyBooking(bookingId, 'BOOKING_CONFIRMED');
  return result;
}

// ---------------------------------------------------------------------------
// Online payments (Razorpay)
// ---------------------------------------------------------------------------

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const hmac = (secret: string, text: string) => createHmac('sha256', secret).update(text).digest('hex');

async function razorpay(path: string, init: { method: 'GET' | 'POST'; body?: unknown }) {
  const cfg = gatewayConfig();
  if (!cfg) throw new FormError('Online payment is not set up yet.');
  let res: Response;
  try {
    res = await fetch(cfg.apiBase + path, {
      method: init.method,
      headers: { Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new FormError('The payment service could not be reached. Please try again.');
  }
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json) {
    console.error('Razorpay request failed', path, res.status, json?.error?.description);
    throw new FormError('The payment service refused the request. Please try again, or pay at the academy.');
  }
  return json;
}

/**
 * Starts an online payment: creates (or reuses) a Razorpay order for what is due and returns what
 * the browser needs to open the checkout. The key secret stays on the server.
 */
export async function createOnlineOrder(bookingId: string, actor: Actor) {
  const cfg = gatewayConfig();
  if (!cfg) throw new FormError('Online payment is not set up yet. Please pay at the academy.');
  const settings = await getRentalSettings();
  const now = new Date();
  const b = await db.rentalBooking.findUnique({ where: { id: bookingId } });
  if (!b) throw new FormError('This booking no longer exists.');
  if (DEAD.includes(b.status) || b.status === 'PENDING') throw new FormError(`This booking is "${label(b.status)}" and cannot be paid for now.`);
  if (b.status === 'PAYMENT_PENDING' && b.expiresAt && b.expiresAt < now) throw new FormError('The hold on this slot has run out. Please book again.');
  const amount = b.status === 'PAYMENT_PENDING' ? advanceDue(b, settings.advancePercent) : amountDue(b);
  if (amount <= 0) throw new FormError('There is nothing to pay on this booking.');

  let order = await db.rentalPayment.findFirst({ where: { bookingId, status: 'CREATED', gateway: 'RAZORPAY', amount }, orderBy: { createdAt: 'desc' } });
  if (!order?.gatewayOrderId) {
    const created = await razorpay('/v1/orders', { method: 'POST', body: { amount: amount * 100, currency: 'INR', receipt: b.code, notes: { bookingId: b.id, code: b.code } } });
    if (typeof created.id !== 'string') throw new FormError('The payment service did not start the payment. Please try again.');
    order = await db.rentalPayment.create({ data: { bookingId, amount, method: 'ONLINE', status: 'CREATED', gateway: 'RAZORPAY', gatewayOrderId: created.id } });
    await audit(db, { bookingId, entity: 'PAYMENT', entityId: order.id, action: 'Online payment started', detail: { amount, orderId: created.id }, actor });
  }
  // Give the customer time to finish paying before the hold is released.
  if (b.status === 'PAYMENT_PENDING' && b.expiresAt && b.expiresAt.getTime() < now.getTime() + 10 * 60_000) {
    await db.rentalBooking.updateMany({ where: { id: b.id, status: 'PAYMENT_PENDING' }, data: { expiresAt: new Date(now.getTime() + 10 * 60_000) } });
  }
  return { orderId: order.gatewayOrderId!, keyId: cfg.keyId, amount, amountPaise: amount * 100, code: b.code, name: b.customerName, phone: b.customerPhone, email: b.customerEmail };
}

/**
 * Records a verified online payment. Safe to call twice (checkout callback and webhook both
 * arrive): the second call finds the payment already marked paid and changes nothing.
 */
async function settle(orderId: string, paymentId: string, amountPaise: number) {
  const settings = await getRentalSettings();
  const result = await rentalTx(async (tx) => {
    const payment = await tx.rentalPayment.findUnique({ where: { gatewayOrderId: orderId }, include: { booking: true } });
    if (!payment) return null;
    if (payment.status === 'PAID') return { bookingId: payment.bookingId, amount: payment.amount, already: true, confirmed: false, late: false };
    if (amountPaise !== payment.amount * 100) throw new FormError('The amount paid does not match the order.');
    const receiptNo = await takeReceiptNo(tx, settings.receiptPrefix);
    await tx.rentalPayment.update({ where: { id: payment.id }, data: { status: 'PAID', gatewayPaymentId: paymentId, reference: paymentId, receiptNo, paidAt: new Date() } });
    const late = DEAD.includes(payment.booking.status);
    const confirmed = await credit(tx, payment.bookingId, payment.amount, settings, GATEWAY);
    await audit(tx, { bookingId: payment.bookingId, entity: 'PAYMENT', entityId: payment.id, action: 'Online payment confirmed', detail: { amount: payment.amount, orderId, paymentId, receiptNo }, actor: GATEWAY });
    if (late) {
      // Paid after the slot was released (the hold ran out, or the booking was cancelled): the money goes back.
      const refund = await tx.rentalRefund.create({ data: { bookingId: payment.bookingId, paymentId: payment.id, amount: payment.amount, reason: `Paid after the booking was ${label(payment.booking.status).toLowerCase()}`, requestedBy: GATEWAY.name } });
      await audit(tx, { bookingId: payment.bookingId, entity: 'REFUND', entityId: refund.id, action: 'Refund due', detail: { amount: payment.amount, reason: 'late payment' }, actor: GATEWAY });
    }
    return { bookingId: payment.bookingId, amount: payment.amount, already: false, confirmed, late };
  });
  if (result && !result.already) {
    await notifyBooking(result.bookingId, 'PAYMENT', { amount: result.amount });
    if (result.confirmed) await notifyBooking(result.bookingId, 'BOOKING_CONFIRMED');
  }
  return result;
}

/**
 * Called by the server after the checkout window closes. The browser only passes along what
 * Razorpay gave it; nothing is believed until the signature (made with our secret key) matches
 * and Razorpay itself reports the payment as captured for this order.
 */
export async function confirmCheckout(input: { orderId: string; paymentId: string; signature: string }) {
  const cfg = gatewayConfig();
  if (!cfg) throw new FormError('Online payment is not set up yet.');
  const { orderId, paymentId, signature } = input;
  if (![orderId, paymentId, signature].every((v) => typeof v === 'string' && v.length > 0 && v.length < 200)) throw new FormError('The payment could not be verified.');
  if (!safeEqual(hmac(cfg.keySecret, `${orderId}|${paymentId}`), signature)) throw new FormError('The payment could not be verified.');
  const payment = await razorpay(`/v1/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });
  if (payment.order_id !== orderId) throw new FormError('The payment could not be verified.');
  if (payment.status !== 'captured') return { state: 'PROCESSING' as const };
  const result = await settle(orderId, paymentId, Number(payment.amount));
  if (!result) throw new FormError('This payment does not belong to a booking here.');
  return { state: result.late ? ('LATE' as const) : ('PAID' as const), bookingId: result.bookingId };
}

/** Razorpay webhook. Only a body signed with our webhook secret is acted on. */
export async function handleWebhook(rawBody: string, signature: string | null) {
  const cfg = gatewayConfig();
  if (!cfg?.webhookSecret) return { status: 503, message: 'Webhook is not configured' };
  if (!signature || !safeEqual(hmac(cfg.webhookSecret, rawBody), signature)) return { status: 400, message: 'Invalid signature' };
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, message: 'Invalid body' };
  }
  try {
    const payment = event?.payload?.payment?.entity;
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && payment?.status === 'captured' && payment.order_id && payment.id) {
      await settle(String(payment.order_id), String(payment.id), Number(payment.amount));
    } else if (event.event === 'payment.failed' && payment?.order_id) {
      const row = await db.rentalPayment.findUnique({ where: { gatewayOrderId: String(payment.order_id) } });
      if (row && row.status === 'CREATED') {
        await audit(db, { bookingId: row.bookingId, entity: 'PAYMENT', entityId: row.id, action: 'Online payment attempt failed', detail: { reason: payment.error_description ?? null }, actor: GATEWAY });
      }
    } else if (event.event === 'refund.processed') {
      const refund = event?.payload?.refund?.entity;
      const row = refund?.id ? await db.rentalRefund.findUnique({ where: { gatewayRefundId: String(refund.id) } }) : null;
      if (row && row.status === 'PENDING') await finishRefund(row.id, { method: 'ONLINE', reference: String(refund.id) }, GATEWAY);
    }
  } catch (e) {
    // A 4xx/5xx would make Razorpay retry for a day; a payment we cannot place is logged instead.
    console.error('Razorpay webhook could not be applied', event?.event, e);
    return { status: e instanceof FormError ? 200 : 500, message: e instanceof FormError ? e.message : 'Error' };
  }
  return { status: 200, message: 'ok' };
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/** Staff asks for money to go back to the customer (e.g. returning the security deposit). */
export async function createRefund(bookingId: string, input: { amount: number; reason: string | null }, actor: Actor) {
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) throw new FormError('Enter the refund amount in whole rupees.');
  return rentalTx(async (tx) => {
    const b = await tx.rentalBooking.findUnique({ where: { id: bookingId }, include: { refunds: { where: { status: 'PENDING' } } } });
    if (!b) throw new FormError('This booking no longer exists.');
    const waiting = b.refunds.reduce((t, r) => t + r.amount, 0);
    if (amount > b.paid - waiting) throw new FormError(`At most ₹${Math.max(0, b.paid - waiting)} can be refunded on this booking.`);
    const refund = await tx.rentalRefund.create({ data: { bookingId, amount, reason: input.reason?.trim().slice(0, 200) || null, requestedBy: actor.name } });
    await audit(tx, { bookingId, entity: 'REFUND', entityId: refund.id, action: 'Refund due', detail: { amount, reason: input.reason }, actor });
    return refund.id;
  });
}

async function finishRefund(refundId: string, how: { method: string; reference: string | null; gatewayRefundId?: string }, actor: Actor) {
  const done = await rentalTx(async (tx) => {
    const refund = await tx.rentalRefund.findUnique({ where: { id: refundId }, include: { booking: true } });
    if (!refund) throw new FormError('This refund no longer exists.');
    if (refund.status !== 'PENDING') throw new FormError('This refund has already been dealt with.');
    if (refund.amount > refund.booking.paid) throw new FormError('The refund is more than the money held for this booking.');
    await tx.rentalRefund.update({
      where: { id: refundId },
      data: { status: 'PROCESSED', method: how.method, reference: how.reference, processedBy: actor.name, processedAt: new Date(), ...(how.gatewayRefundId ? { gatewayRefundId: how.gatewayRefundId } : {}) },
    });
    await tx.rentalBooking.update({ where: { id: refund.bookingId }, data: { paid: { decrement: refund.amount } } });
    await audit(tx, { bookingId: refund.bookingId, entity: 'REFUND', entityId: refund.id, action: 'Refund processed', detail: { amount: refund.amount, ...how }, actor });
    if (canTransition(refund.booking.status, 'REFUNDED')) await applyStatus(tx, refund.bookingId, 'REFUNDED', actor, { note: `₹${refund.amount} refunded` });
    return { bookingId: refund.bookingId, amount: refund.amount };
  });
  await notifyBooking(done.bookingId, 'REFUND', { amount: done.amount });
  return done;
}

/** Staff paid the money back by hand (cash, UPI, bank transfer) and records it. */
export async function processRefund(refundId: string, input: { method: string; reference?: string | null }, actor: Actor) {
  if (!(input.method in OFFLINE_METHODS)) throw new FormError('Choose how the refund was paid.');
  return finishRefund(refundId, { method: input.method, reference: input.reference?.trim().slice(0, 80) || null }, actor);
}

/** Sends the refund back through Razorpay to the card / UPI the customer paid with. */
export async function refundViaGateway(refundId: string, actor: Actor) {
  const refund = await db.rentalRefund.findUnique({ where: { id: refundId }, include: { booking: { include: { payments: { where: { status: 'PAID', gateway: 'RAZORPAY' }, include: { refunds: { where: { status: 'PROCESSED' } } } } } } } });
  if (!refund) throw new FormError('This refund no longer exists.');
  if (refund.status !== 'PENDING') throw new FormError('This refund has already been dealt with.');
  const source = refund.booking.payments.find((p) => p.gatewayPaymentId && p.amount - p.refunds.reduce((t, r) => t + r.amount, 0) >= refund.amount);
  if (!source) throw new FormError('No online payment on this booking is large enough for this refund. Pay it back by hand and record it instead.');
  const created = await razorpay(`/v1/payments/${encodeURIComponent(source.gatewayPaymentId!)}/refund`, { method: 'POST', body: { amount: refund.amount * 100, notes: { refundId: refund.id, code: refund.booking.code } } });
  if (typeof created.id !== 'string') throw new FormError('The payment service did not accept the refund.');
  await db.rentalRefund.update({ where: { id: refund.id }, data: { paymentId: source.id } });
  return finishRefund(refund.id, { method: 'ONLINE', reference: created.id, gatewayRefundId: created.id }, actor);
}

export async function declineRefund(refundId: string, note: string | null, actor: Actor) {
  return rentalTx(async (tx) => {
    const refund = await tx.rentalRefund.findUnique({ where: { id: refundId } });
    if (!refund) throw new FormError('This refund no longer exists.');
    if (refund.status !== 'PENDING') throw new FormError('This refund has already been dealt with.');
    await tx.rentalRefund.update({ where: { id: refundId }, data: { status: 'REJECTED', processedBy: actor.name, processedAt: new Date(), reference: note?.trim().slice(0, 80) || null } });
    await audit(tx, { bookingId: refund.bookingId, entity: 'REFUND', entityId: refund.id, action: 'Refund declined', detail: note, actor });
  });
}
