'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionUser } from '@/lib/auth';
import { ATTENDANCE_STATUS } from '@/lib/constants';
import { formatDate, todayISO } from '@/lib/dates';
import { FormError, run } from '@/lib/form';

/** Saves the attendance sheet of one batch for one day. Blank entries remove any existing mark. */
export async function saveAttendance(batchId: string, day: string, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) throw new FormError('Invalid date.');
    if (day > todayISO()) throw new FormError('You cannot mark attendance for a future date.');
    const batch = await db.batch.findUnique({
      where: { id: batchId },
      include: { students: { where: { status: { not: 'INACTIVE' } }, select: { id: true } } },
    });
    if (!batch) throw new FormError('This batch no longer exists.');

    let marked = 0;
    await db.$transaction(
      batch.students.map(({ id }) => {
        const status = String(fd.get(`s_${id}`) ?? '');
        if (status && !(status in ATTENDANCE_STATUS)) throw new FormError('Invalid attendance value.');
        if (!status) return db.attendance.deleteMany({ where: { studentId: id, date: day } });
        marked++;
        return db.attendance.upsert({
          where: { studentId_date: { studentId: id, date: day } },
          create: { studentId: id, date: day, status, batchId, markedBy: user.name },
          update: { status, batchId, markedBy: user.name },
        });
      }),
    );
    revalidatePath('/', 'layout');
    return `Attendance saved for ${batch.name} on ${formatDate(day)} (${marked}/${batch.students.length} marked)`;
  });
}
