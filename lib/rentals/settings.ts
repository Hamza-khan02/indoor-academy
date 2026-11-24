// Booking & rental settings (saved in the Setting table under "rental.*"), and whether the
// online payment gateway and email are set up (those come from the server's environment, never the database).
import { db } from '../db';

export type RentalSettings = {
  /** Minutes an online booking is held while the customer pays. */
  holdMinutes: number;
  /** Hours a "pay at the academy" booking is held unpaid before it is released. 0 = confirm at once. */
  offlineHoldHours: number;
  /** Share of the booking amount that must be paid to confirm it. */
  advancePercent: number;
  /** How many days ahead customers can book. */
  bookingWindowDays: number;
  /** Customers cannot book a slot that starts sooner than this many minutes from now. */
  minLeadMinutes: number;
  /** Customers can reschedule until this many hours before the start. */
  rescheduleCutoffHours: number;
  maxReschedules: number;
  /** Reminder is sent this many hours before a booking starts. */
  reminderHours: number;
  allowPayAtVenue: boolean;
  /** UPI ID shown to customers for paying at the counter (optional). */
  upiId: string;
  upiName: string;
  receiptPrefix: string;
};

export const DEFAULT_RENTAL_SETTINGS: RentalSettings = {
  holdMinutes: 15,
  offlineHoldHours: 0,
  advancePercent: 100,
  bookingWindowDays: 30,
  minLeadMinutes: 30,
  rescheduleCutoffHours: 6,
  maxReschedules: 2,
  reminderHours: 24,
  allowPayAtVenue: true,
  upiId: '',
  upiName: '',
  receiptPrefix: 'IAR',
};

const PREFIX = 'rental.';
const KEYS = Object.keys(DEFAULT_RENTAL_SETTINGS) as (keyof RentalSettings)[];

export async function getRentalSettings(): Promise<RentalSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: KEYS.map((k) => PREFIX + k) } } });
  const out: Record<string, unknown> = { ...DEFAULT_RENTAL_SETTINGS };
  for (const row of rows) {
    const key = row.key.slice(PREFIX.length) as keyof RentalSettings;
    const fallback = DEFAULT_RENTAL_SETTINGS[key];
    if (typeof fallback === 'number') out[key] = Number.isFinite(Number(row.value)) ? Number(row.value) : fallback;
    else if (typeof fallback === 'boolean') out[key] = row.value === 'true';
    else out[key] = row.value;
  }
  return out as RentalSettings;
}

export async function saveRentalSettings(values: Partial<RentalSettings>) {
  const entries = Object.entries(values).filter(([k]) => (KEYS as string[]).includes(k));
  await db.$transaction(
    entries.map(([k, v]) => db.setting.upsert({ where: { key: PREFIX + k }, create: { key: PREFIX + k, value: String(v) }, update: { value: String(v) } })),
  );
}

/** Razorpay keys from the environment, or null when online payment is not set up. Secrets never leave the server. */
export function gatewayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return {
    keyId,
    keySecret,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null,
    apiBase: (process.env.RAZORPAY_API_BASE?.trim() || 'https://api.razorpay.com').replace(/\/+$/, ''),
  };
}

/** SMTP details from the environment, or null when email is not set up. */
export function emailConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
  if (!host || !from) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    user: process.env.SMTP_USER?.trim() || null,
    pass: process.env.SMTP_PASS || null,
    from,
  };
}
