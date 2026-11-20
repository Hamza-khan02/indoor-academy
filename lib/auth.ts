import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { FormError } from './form';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from './session';

export type CurrentUser = { id: string; name: string; email: string; role: string };

/** The logged-in user for this request, or null. Re-checked against the database every request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true },
  });
});

/** For pages: send logged-out visitors to the login screen. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
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
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // HTTPS-only in production. Set COOKIE_SECURE="false" to run a production build
    // over plain http on a local network (e.g. http://192.168.1.10:3000).
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function endSession() {
  cookies().delete(SESSION_COOKIE);
}
