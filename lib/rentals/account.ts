// Who is booking: an academy family (their existing parent app login, which brings student
// prices) or an outside customer (their own booking account). One person never needs two accounts.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { displayPhone, getFamily } from '../family';
import { CUSTOMER_COOKIE, CUSTOMER_MAX_AGE, signCustomerSession, verifyCustomerSession } from '../session';
import type { Actor } from './core';

/** The logged-in outside customer for this request, or null. Re-checked against the database every request. */
export const getCustomer = cache(async () => {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyCustomerSession(token);
  if (!session) return null;
  const customer = await db.rentalCustomer.findUnique({ where: { id: session.cid } });
  if (!customer || !customer.active || customer.sessionVersion !== session.v) return null;
  return customer;
});

export type Booker =
  | { kind: 'FAMILY'; familyLoginId: string; label: string; students: { id: string; name: string; status: string }[] }
  | { kind: 'CUSTOMER'; customerId: string; label: string; name: string; phone: string; email: string | null };

/** The person using the booking site, or null when nobody is logged in. A family login wins (student prices). */
export const getBooker = cache(async (): Promise<Booker | null> => {
  const family = await getFamily();
  if (family) return { kind: 'FAMILY', familyLoginId: family.login.id, label: displayPhone(family.login.phoneKey), students: family.students };
  const customer = await getCustomer();
  if (customer) return { kind: 'CUSTOMER', customerId: customer.id, label: customer.name, name: customer.name, phone: customer.phone, email: customer.email };
  return null;
});

export async function requireBooker(next?: string) {
  const booker = await getBooker();
  if (!booker) redirect(`/book/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return booker;
}

/** The bookings this person may see and manage: their own, or those of their family's children. */
export function ownBookings(booker: Booker): Prisma.RentalBookingWhereInput {
  if (booker.kind === 'CUSTOMER') return { customerId: booker.customerId };
  return { OR: [{ familyLoginId: booker.familyLoginId }, { studentId: { in: booker.students.map((s) => s.id) } }] };
}

export function ownNotifications(booker: Booker): Prisma.RentalNotificationWhereInput {
  return booker.kind === 'CUSTOMER' ? { customerId: booker.customerId } : { familyLoginId: booker.familyLoginId };
}

export function bookerActor(booker: Booker): Actor {
  return booker.kind === 'CUSTOMER' ? { type: 'CUSTOMER', name: booker.name } : { type: 'FAMILY', name: `Family ${booker.label}` };
}

export async function startCustomerSession(customer: { id: string; sessionVersion: number }) {
  const token = await signCustomerSession({ cid: customer.id, v: customer.sessionVersion });
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    path: '/',
    maxAge: CUSTOMER_MAX_AGE,
  });
}

export async function endCustomerSession() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}
