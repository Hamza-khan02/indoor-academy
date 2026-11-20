'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin, actionUser } from '@/lib/auth';
import { AGE_GROUPS, PLAYING_ROLES, STUDENT_STATUS } from '@/lib/constants';
import { todayISO } from '@/lib/dates';
import { FormError, date, oneOf, phone, run, text } from '@/lib/form';
import { phoneKey } from '@/lib/family';

async function parseStudent(fd: FormData) {
  const branchId = text(fd, 'branchId', { required: true, label: 'Branch' });
  const batchId = text(fd, 'batchId', { label: 'Batch' });
  const branch = await db.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new FormError('Choose a valid branch.');
  if (batchId) {
    const batch = await db.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new FormError('Choose a valid batch.');
    if (batch.branchId !== branchId) throw new FormError(`Batch "${batch.name}" belongs to a different branch.`);
  }
  const dob = date(fd, 'dob', { label: 'Date of birth' });
  if (dob && dob > todayISO()) throw new FormError('Date of birth cannot be in the future.');
  const guardianPhone = phone(fd, 'guardianPhone', { required: true, label: 'Guardian phone' })!;

  return {
    name: text(fd, 'name', { required: true, label: 'Full name', max: 80 }),
    dob,
    ageGroup: oneOf(fd, 'ageGroup', AGE_GROUPS, { required: true, label: 'Age group' }),
    playingRole: oneOf(fd, 'playingRole', PLAYING_ROLES, { label: 'Playing role' }),
    guardianName: text(fd, 'guardianName', { label: 'Guardian name', max: 80 }),
    guardianPhone,
    // Links the student to the parent app login for this phone.
    guardianPhoneKey: phoneKey(guardianPhone),
    status: oneOf(fd, 'status', Object.keys(STUDENT_STATUS), { label: 'Status' }) ?? 'ACTIVE',
    joinedOn: date(fd, 'joinedOn', { label: 'Joining date' }) ?? todayISO(),
    notes: text(fd, 'notes', { label: 'Notes', max: 500 }),
    branchId,
    batchId,
  };
}

function refresh(id?: string) {
  revalidatePath('/', 'layout');
  if (id) revalidatePath(`/students/${id}`);
}

export async function createStudent(fd: FormData) {
  return run(async () => {
    await actionUser();
    const data = await parseStudent(fd);
    await db.student.create({ data });
    refresh();
    return `${data.name} added to the academy`;
  });
}

export async function updateStudent(id: string, fd: FormData) {
  return run(async () => {
    await actionUser();
    const data = await parseStudent(fd);
    await db.student.update({ where: { id }, data });
    refresh(id);
    return `${data.name} updated`;
  });
}

export async function deleteStudent(id: string) {
  return run(async () => {
    await actionAdmin();
    const s = await db.student.delete({ where: { id } });
    refresh();
    return `${s.name} and their attendance, fee and assessment records were deleted`;
  });
}
