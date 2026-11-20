'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin } from '@/lib/auth';
import { AGE_GROUPS, DAYS } from '@/lib/constants';
import { FormError, int, oneOf, run, text, time } from '@/lib/form';

async function parseBatch(fd: FormData) {
  const branchId = text(fd, 'branchId', { required: true, label: 'Branch' });
  if (!(await db.branch.findUnique({ where: { id: branchId } }))) throw new FormError('Choose a valid branch.');
  const coachId = text(fd, 'coachId');
  if (coachId && !(await db.coach.findUnique({ where: { id: coachId } }))) throw new FormError('Choose a valid coach.');

  const days = fd.getAll('days').map(String).filter((d) => DAYS.includes(d));
  if (days.length === 0) throw new FormError('Pick at least one training day.');
  const startTime = time(fd, 'startTime', { required: true, label: 'Start time' })!;
  const endTime = time(fd, 'endTime', { required: true, label: 'End time' })!;
  if (endTime <= startTime) throw new FormError('End time must be after start time.');

  return {
    name: text(fd, 'name', { required: true, label: 'Batch name', max: 60 }),
    ageGroup: oneOf(fd, 'ageGroup', AGE_GROUPS, { required: true, label: 'Age group' })!,
    days: DAYS.filter((d) => days.includes(d)).join(','),
    startTime,
    endTime,
    venue: text(fd, 'venue', { label: 'Venue', max: 60 }),
    monthlyFee: int(fd, 'monthlyFee', { label: 'Monthly fee', min: 0, max: 1_000_000 }) ?? 0,
    active: fd.get('active') !== 'false',
    branchId,
    coachId,
  };
}

export async function createBatch(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = await parseBatch(fd);
    await db.batch.create({ data });
    revalidatePath('/', 'layout');
    return `Batch ${data.name} created`;
  });
}

export async function updateBatch(id: string, fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = await parseBatch(fd);
    const existing = await db.batch.findUnique({ where: { id }, include: { _count: { select: { students: true } } } });
    if (!existing) throw new FormError('This batch no longer exists.');
    if (existing.branchId !== data.branchId && existing._count.students > 0) {
      throw new FormError('This batch has students. Move them to another batch before changing its branch.');
    }
    await db.batch.update({ where: { id }, data });
    revalidatePath('/', 'layout');
    return `Batch ${data.name} updated`;
  });
}

export async function deleteBatch(id: string) {
  return run(async () => {
    await actionAdmin();
    const b = await db.batch.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return `Batch ${b.name} deleted. Its students are now unassigned.`;
  });
}
