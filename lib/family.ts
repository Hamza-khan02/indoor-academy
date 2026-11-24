// Parent / student app: phone matching, sessions and access checks.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { whatsappNumber } from './messages';
import { PARENT_COOKIE, PARENT_MAX_AGE, signParentSession, verifyParentSession } from './session';

/** Normalised phone used to match a parent login to students: digits with country code. */
export function phoneKey(phone: string | null | undefined) {
  return whatsappNumber(phone);
}

/** Fills guardianPhoneKey for students saved before the parent app existed. Cheap when nothing is missing. */
export async function ensurePhoneKeys() {
  const missing = await db.student.findMany({ where: { guardianPhoneKey: null }, select: { id: true, guardianPhone: true } });
  for (const s of missing) {
    const key = phoneKey(s.guardianPhone);
    if (key) await db.student.update({ where: { id: s.id }, data: { guardianPhoneKey: key } });
  }
}

/** '919876543210' -> '+91 98765 43210' */
export function displayPhone(key: string) {
  if (key.length === 12 && key.startsWith('91')) return `+91 ${key.slice(2, 7)} ${key.slice(7)}`;
  return `+${key}`;
}

/** The logged-in family for this request (login + their students), or null. */
export const getFamily = cache(async () => {
  const token = (await cookies()).get(PARENT_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyParentSession(token);
  if (!session) return null;
  const login = await db.familyLogin.findUnique({ where: { id: session.fid } });
  if (!login || !login.active || login.sessionVersion !== session.v) return null;
  const students = await db.student.findMany({
    where: { guardianPhoneKey: login.phoneKey },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, status: true },
  });
  return { login, students };
});

export async function requireFamily() {
  const family = await getFamily();
  if (!family) redirect('/parent/login');
  return family;
}

export async function startParentSession(login: { id: string; sessionVersion: number }) {
  const token = await signParentSession({ fid: login.id, v: login.sessionVersion });
  (await cookies()).set(PARENT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    path: '/',
    maxAge: PARENT_MAX_AGE,
  });
}

export async function endParentSession() {
  (await cookies()).delete(PARENT_COOKIE);
}
