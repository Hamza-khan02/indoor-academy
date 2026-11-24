'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin, actionStaff } from '@/lib/auth';
import { USER_ROLES } from '@/lib/constants';
import { FormError, email, oneOf, run, text } from '@/lib/form';

const MIN_PASSWORD = 8;

function newPassword(fd: FormData, key = 'password') {
  const value = String(fd.get(key) ?? '');
  if (value.length < MIN_PASSWORD) throw new FormError(`Password must be at least ${MIN_PASSWORD} characters.`);
  if (value.length > 100) throw new FormError('Password is too long.');
  return value;
}

export async function changePassword(fd: FormData) {
  return run(async () => {
    const me = await actionStaff();
    const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await bcrypt.compare(String(fd.get('current') ?? ''), user.passwordHash))) {
      throw new FormError('Your current password is incorrect.');
    }
    const password = newPassword(fd);
    if (password !== String(fd.get('confirm') ?? '')) throw new FormError('The new passwords do not match.');
    await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    return 'Password changed';
  });
}

export async function createUser(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = {
      name: text(fd, 'name', { required: true, label: 'Name', max: 80 }),
      email: email(fd, 'email', { required: true, label: 'Email' })!,
      role: oneOf(fd, 'role', Object.keys(USER_ROLES), { required: true, label: 'Role' })!,
      passwordHash: await bcrypt.hash(newPassword(fd), 10),
    };
    if (await db.user.findUnique({ where: { email: data.email } })) throw new FormError('A user with this email already exists.');
    await db.user.create({ data });
    revalidatePath('/settings');
    return `Login created for ${data.name}`;
  });
}

export async function resetPassword(id: string, fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const u = await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(newPassword(fd), 10) } });
    return `Password reset for ${u.name}`;
  });
}

export async function deleteUser(id: string) {
  return run(async () => {
    const me = await actionAdmin();
    if (id === me.id) throw new FormError('You cannot delete your own account.');
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new FormError('This user no longer exists.');
    if (target.role === 'ADMIN' && (await db.user.count({ where: { role: 'ADMIN' } })) <= 1) {
      throw new FormError('At least one administrator must remain.');
    }
    await db.user.delete({ where: { id } });
    revalidatePath('/settings');
    return `${target.name}'s login was removed`;
  });
}
