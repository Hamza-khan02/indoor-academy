'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { actionAdmin, actionUser } from './auth';
import { FormError, phone, run, text } from './form';

/** Records that a WhatsApp message (reminder, absence notice or receipt) was opened for a parent. */
export async function logReminder(studentId: string, kind: string, ref: string) {
  return run(async () => {
    const user = await actionUser();
    if (kind === 'FEE') {
      if (user.role !== 'ADMIN') throw new FormError('Only an administrator can send fee reminders.');
      if (!/^\d{4}-\d{2}$/.test(ref)) throw new FormError('Invalid month.');
    } else if (kind === 'ABSENT') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ref)) throw new FormError('Invalid date.');
    } else if (kind === 'REPORT') {
      if (!/^\d{4}-\d{2}$/.test(ref)) throw new FormError('Invalid month.');
    } else if (kind === 'RECEIPT') {
      if (user.role !== 'ADMIN') throw new FormError('Only an administrator can send receipts.');
      const payment = await db.feePayment.findUnique({ where: { id: ref }, select: { studentId: true } });
      if (!payment || payment.studentId !== studentId) throw new FormError('This payment no longer exists.');
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

async function saveSettings(values: Record<string, string>) {
  await db.$transaction(
    Object.entries(values).map(([key, value]) => db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })),
  );
  revalidatePath('/', 'layout');
}

export async function updateMessageSettings(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    await saveSettings({
      academyName: text(fd, 'academyName', { required: true, label: 'Academy name', max: 60 }),
      feeTemplate: text(fd, 'feeTemplate', { required: true, label: 'Fee reminder message', max: 1000 }),
      absentTemplate: text(fd, 'absentTemplate', { required: true, label: 'Absence message', max: 1000 }),
      receiptTemplate: text(fd, 'receiptTemplate', { required: true, label: 'Receipt message', max: 1000 }),
      parentAccessTemplate: text(fd, 'parentAccessTemplate', { required: true, label: 'Parent app login message', max: 1000 }),
    });
    return 'WhatsApp messages saved';
  });
}

export async function updateReceiptSettings(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const prefix = text(fd, 'receiptPrefix', { required: true, label: 'Receipt prefix', max: 10 }).toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(prefix)) throw new FormError('Receipt prefix can only use letters, numbers and hyphens.');
    await saveSettings({
      receiptPrefix: prefix,
      academyAddress: text(fd, 'academyAddress', { label: 'Address', max: 200 }) ?? '',
      academyPhone: phone(fd, 'academyPhone', { label: 'Academy phone' }) ?? '',
      receiptNote: text(fd, 'receiptNote', { label: 'Receipt note', max: 300 }) ?? '',
    });
    return 'Receipt details saved';
  });
}
