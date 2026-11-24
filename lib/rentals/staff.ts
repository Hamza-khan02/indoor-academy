// Permission checks for staff in the bookings section. Every page and every server action goes
// through these, so access is decided on the server (hiding a button is never the only protection).
import { redirect } from 'next/navigation';
import { actionStaff, requireStaff } from '../auth';
import { USER_ROLES } from '../constants';
import { FormError } from '../form';
import { type RentalPermission, can } from './constants';
import type { Actor } from './core';

/** For pages: the logged-in staff member, or a redirect to somewhere their role may be. */
export async function requireRental(permission: RentalPermission) {
  const user = await requireStaff();
  if (!can(user.role, permission)) {
    redirect(can(user.role, 'view') ? '/bookings?denied=1' : can(user.role, 'schedule') ? '/bookings/calendar?denied=1' : '/?denied=1');
  }
  return user;
}

/** For server actions: who is acting (for the audit log), or an error shown in the form. */
export async function rentalActor(permission: RentalPermission): Promise<Actor> {
  const user = await actionStaff();
  if (!can(user.role, permission)) throw new FormError('Your role does not allow this.');
  return { type: 'STAFF', name: user.name, role: USER_ROLES[user.role] ?? user.role };
}
