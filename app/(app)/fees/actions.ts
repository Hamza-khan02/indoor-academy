'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin } from '@/lib/auth';
import { PAYMENT_METHODS } from '@/lib/constants';
import { todayISO } from '@/lib/dates';
import { inr } from '@/lib/format';
import { FormError, date, int, month, oneOf, run, text } from '@/lib/form';

export async function recordPayment(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const studentId = text(fd, 'studentId', { required: true, label: 'Student' });
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) throw new FormError('Choose a valid student.');
    const paidOn = date(fd, 'paidOn', { required: true, label: 'Payment date' })!;
    if (paidOn > todayISO()) throw new FormError('Payment date cannot be in the future.');
    const amount = int(fd, 'amount', { required: true, label: 'Amount', min: 1, max: 1_000_000 })!;

    await db.feePayment.create({
      data: {
        studentId,
        amount,
        paidOn,
        forMonth: month(fd, 'forMonth', { required: true, label: 'Fee month' })!,
        method: oneOf(fd, 'method', Object.keys(PAYMENT_METHODS), { required: true, label: 'Payment method' })!,
        reference: text(fd, 'reference', { label: 'Reference', max: 100 }),
      },
    });
    revalidatePath('/', 'layout');
    return `${inr(amount)} recorded for ${student.name}`;
  });
}

export async function deletePayment(id: string) {
  return run(async () => {
    await actionAdmin();
    const p = await db.feePayment.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return `Payment of ${inr(p.amount)} deleted`;
  });
}
