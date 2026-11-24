import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { FormError } from './form';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from './session';

export type CurrentUser = { id: string; name: string; email: string; role: string };

/** The logged-in user for this request, or null. Re-checked against the database every request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true },
  });
});

/** A receptionist's login only works the bookings desk, not the academy app (students, fees, attendance ...). */
const DESK_ONLY = 'RECEPTIONIST';

/** For pages any staff member may open (the bookings desk, their own account). */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** For pages of the academy app: send logged-out visitors to the login screen, and desk-only logins to the bookings desk. */
export async function requireUser() {
  const user = await requireStaff();
  if (user.role === DESK_ONLY) redirect('/bookings');
  return user;
}

/** For admin-only pages. */
export async function requireAdminPage() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/?denied=1');
  return user;
}

/** For server actions: returns the user or throws a message shown in the form. */
export async function actionUser() {
  const user = await actionStaff();
  if (user.role === DESK_ONLY) throw new FormError('Your login is for the bookings desk only.');
  return user;
}

/** For server actions any staff member may run (bookings desk, own password). */
export async function actionStaff() {
  const user = await getCurrentUser();
  if (!user) throw new FormError('Your session has expired. Please log in again.');
  return user;
}

export async function actionAdmin() {
  const user = await actionUser();
  if (user.role !== 'ADMIN') throw new FormError('Only an administrator can do this.');
  return user;
}

export async function startSession(user: { id: string; role: string }) {
  const token = await signSession({ uid: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // HTTPS-only in production. Set COOKIE_SECURE="false" to run a production build
    // over plain http on a local network (e.g. http://192.168.1.10:3000).
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
