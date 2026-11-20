import type { Prisma } from '@prisma/client';
import { db } from './db';

export const DEFAULT_RECEIPT_PREFIX = 'IA';

/** Indian financial year (April–March) for a 'YYYY-MM-DD' date, e.g. '2026-11-20' -> '2026-27'. */
export function financialYear(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function formatReceiptNo(prefix: string, fy: string, seq: number) {
  return `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;
}

export async function getReceiptPrefix() {
  const row = await db.setting.findUnique({ where: { key: 'receiptPrefix' } });
  return row?.value || DEFAULT_RECEIPT_PREFIX;
}

/**
 * Takes the next receipt number for the financial year of `paidOn`.
 * Call inside a transaction, before any other query in it: the counter is bumped by a single
 * atomic write, so concurrent payments queue up instead of deadlocking (SQLite) or colliding.
 * If the transaction fails, the bump is rolled back, so numbers never skip or repeat.
 */
export async function takeReceiptNo(tx: Prisma.TransactionClient, paidOn: string, prefix: string) {
  const fy = financialYear(paidOn);
  const key = `receiptSeq:${fy}`;
  const rows = await tx.$queryRaw<{ value: string }[]>`
    INSERT INTO "Setting" ("key", "value") VALUES (${key}, '1')
    ON CONFLICT ("key") DO UPDATE SET "value" = CAST(CAST("Setting"."value" AS INTEGER) + 1 AS TEXT)
    RETURNING "value"`;
  return formatReceiptNo(prefix, fy, Number(rows[0].value));
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 10_000 };

/** Runs a receipt-numbering transaction, retrying briefly if the database is busy. */
export async function receiptTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await db.$transaction(fn, TX_OPTIONS);
    } catch (e: any) {
      const busy = ['P2028', 'P2034', 'P1008'].includes(e?.code) || /database is locked|socket timeout/i.test(String(e?.message));
      if (!busy || i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 40 * i + Math.random() * 80));
    }
  }
}

class AlreadyNumbered extends Error {}

/** Gives a receipt number to a payment recorded before receipts existed. Safe to call repeatedly. */
export async function ensureReceiptNo(payment: { id: string; paidOn: string; receiptNo: string | null }) {
  if (payment.receiptNo) return payment.receiptNo;
  const prefix = await getReceiptPrefix();
  try {
    return await receiptTransaction(async (tx) => {
      const receiptNo = await takeReceiptNo(tx, payment.paidOn, prefix);
      const { count } = await tx.feePayment.updateMany({ where: { id: payment.id, receiptNo: null }, data: { receiptNo } });
      if (count === 0) throw new AlreadyNumbered(); // someone numbered it meanwhile; roll back our bump
      return receiptNo;
    });
  } catch (e) {
    if (!(e instanceof AlreadyNumbered)) throw e;
    const current = await db.feePayment.findUniqueOrThrow({ where: { id: payment.id }, select: { receiptNo: true } });
    return current.receiptNo!;
  }
}
