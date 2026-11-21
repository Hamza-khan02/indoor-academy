'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionUser } from '@/lib/auth';
import { FormError, run, text } from '@/lib/form';
import { isValidMonth } from '@/lib/report';

/** Saves (or clears, when empty) the coach's comment on a student's monthly report. */
export async function saveProgressComment(studentId: string, month: string, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    if (!isValidMonth(month)) throw new FormError('Invalid month.');
    if (!(await db.student.findUnique({ where: { id: studentId }, select: { id: true } }))) throw new FormError('This student no longer exists.');
    const comment = text(fd, 'comment', { label: 'Comment', max: 1000 });
    if (!comment) {
      await db.progressComment.deleteMany({ where: { studentId, month } });
    } else {
      await db.progressComment.upsert({
        where: { studentId_month: { studentId, month } },
        create: { studentId, month, comment, author: user.name },
        update: { comment, author: user.name },
      });
    }
    revalidatePath('/', 'layout');
    return comment ? 'Comment saved' : 'Comment removed';
  });
}
