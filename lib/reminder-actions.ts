'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { actionAdmin, actionUser } from './auth';
import { FormError, run, text } from './form';

/** Records that a WhatsApp reminder was opened for a parent. */
export async function logReminder(studentId: string, kind: string, ref: string) {
  return run(async () => {
    const user = await actionUser();
    if (kind === 'FEE') {
      if (user.role !== 'ADMIN') throw new FormError('Only an administrator can send fee reminders.');
      if (!/^\d{4}-\d{2}$/.test(ref)) throw new FormError('Invalid month.');
    } else if (kind === 'ABSENT') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ref)) throw new FormError('Invalid date.');
    } else {
      throw new FormError('Invalid reminder type.');
    }
    const student = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) throw new FormError('This student no longer exists.');
    await db.reminder.create({ data: { studentId, kind, ref, sentBy: user.name } });
    revalidatePath('/', 'layout');
    return 'Reminder logged';
  });
}

export async function updateMessageSettings(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const values = {
      academyName: text(fd, 'academyName', { required: true, label: 'Academy name', max: 60 }),
      feeTemplate: text(fd, 'feeTemplate', { required: true, label: 'Fee reminder message', max: 1000 }),
      absentTemplate: text(fd, 'absentTemplate', { required: true, label: 'Absence message', max: 1000 }),
    };
    await db.$transaction(
      Object.entries(values).map(([key, value]) => db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })),
    );
    revalidatePath('/', 'layout');
    return 'WhatsApp messages saved';
  });
}
