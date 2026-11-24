// Shared plumbing for booking & rental writes: who is acting, the transaction wrapper and the audit log.
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { FormError } from '../form';

export type Tx = Prisma.TransactionClient;

/** Who is doing something. Recorded in the audit log; permissions are checked before the call. */
export type Actor = { type: 'STAFF' | 'CUSTOMER' | 'FAMILY' | 'SYSTEM' | 'GATEWAY'; name: string; role?: string };
export const SYSTEM: Actor = { type: 'SYSTEM', name: 'System' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs a booking / payment / inventory change as one all-or-nothing transaction.
 *
 * The first statement is a write, so the database gives this transaction the write lock at once
 * and every other booking transaction waits its turn. That makes "check it is free, then reserve
 * it" safe: nobody else can reserve in between. A busy database is retried a few times.
 * The ResourceSlot primary key is the last line of defence against a double booking.
 */
export async function rentalTx<T>(fn: (tx: Tx) => Promise<T>, attempts = 6): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`
            INSERT INTO "Setting" ("key", "value") VALUES ('rental.txCounter', '1')
            ON CONFLICT ("key") DO UPDATE SET "value" = CAST(CAST("Setting"."value" AS INTEGER) + 1 AS TEXT)`;
          return fn(tx);
        },
        { maxWait: 15_000, timeout: 20_000 },
      );
    } catch (e: any) {
      if (e instanceof FormError) throw e;
      const busy = ['P2028', 'P2034', 'P1008'].includes(e?.code) || /database is locked|socket timeout|SQLITE_BUSY/i.test(String(e?.message));
      if (busy && attempt < attempts) {
        await sleep(40 * attempt + Math.random() * 100);
        continue;
      }
      if (e?.code === 'P2002' && /ResourceSlot/i.test(`${e?.meta?.modelName ?? ''} ${e?.message ?? ''}`)) {
        throw new FormError('That time has just been booked by someone else. Please pick another slot.');
      }
      throw e;
    }
  }
}

export async function audit(
  tx: Tx | typeof db,
  entry: { bookingId?: string | null; entity: string; entityId?: string | null; action: string; detail?: unknown; actor: Actor },
) {
  const detail = entry.detail === undefined || entry.detail === null ? null : typeof entry.detail === 'string' ? entry.detail : JSON.stringify(entry.detail);
  await tx.rentalAuditLog.create({
    data: {
      bookingId: entry.bookingId ?? null,
      entity: entry.entity,
      entityId: entry.entityId ?? entry.bookingId ?? null,
      action: entry.action,
      detail: detail ? detail.slice(0, 2000) : null,
      actorType: entry.actor.type,
      actorName: entry.actor.role ? `${entry.actor.name} (${entry.actor.role})` : entry.actor.name,
    },
  });
}

/** What is still to pay on a booking (amount + refundable deposit - money received). */
export const amountDue = (b: { total: number; deposit: number; paid: number }) => Math.max(0, b.total + b.deposit - b.paid);

/** What must be paid before an unpaid booking is confirmed. */
export function advanceDue(b: { total: number; deposit: number; paid: number }, advancePercent: number) {
  const needed = Math.ceil((b.total * Math.min(100, Math.max(0, advancePercent))) / 100) + b.deposit;
  return Math.max(0, Math.min(needed, b.total + b.deposit) - b.paid);
}
