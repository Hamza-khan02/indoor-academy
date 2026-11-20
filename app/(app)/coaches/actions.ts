'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin } from '@/lib/auth';
import { FormError, email, phone, run, text } from '@/lib/form';

async function parseCoach(fd: FormData) {
  const branchId = text(fd, 'branchId');
  if (branchId && !(await db.branch.findUnique({ where: { id: branchId } }))) throw new FormError('Choose a valid branch.');
  return {
    name: text(fd, 'name', { required: true, label: 'Name', max: 80 }),
    phone: phone(fd, 'phone', { label: 'Phone' }),
    email: email(fd, 'email', { label: 'Email' }),
    specialization: text(fd, 'specialization', { label: 'Specialization', max: 60 }),
    active: fd.get('active') !== 'false',
    branchId,
  };
}

export async function createCoach(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = await parseCoach(fd);
    await db.coach.create({ data });
    revalidatePath('/', 'layout');
    return `Coach ${data.name} added`;
  });
}

export async function updateCoach(id: string, fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = await parseCoach(fd);
    await db.coach.update({ where: { id }, data });
    revalidatePath('/', 'layout');
    return `Coach ${data.name} updated`;
  });
}

export async function deleteCoach(id: string) {
  return run(async () => {
    await actionAdmin();
    const c = await db.coach.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return `Coach ${c.name} deleted. Their batches now have no coach assigned.`;
  });
}
