'use server';

// Parent app: mark a drill done / not done for one of the family's own children.
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { getFamily } from './family';
import { drillTargetsStudent } from './drills';
import { FormError, run, text } from './form';

async function check(drillId: string, studentId: string) {
  const family = await getFamily();
  if (!family) throw new FormError('Your session has expired. Please log in again.');
  if (!family.students.some((s) => s.id === studentId)) throw new FormError('You can only update your own child.');
  const [drill, student] = await Promise.all([
    db.drill.findUnique({ where: { id: drillId }, include: { students: { select: { studentId: true } } } }),
    db.student.findUnique({ where: { id: studentId }, select: { id: true, batchId: true } }),
  ]);
  if (!drill || !student || !drillTargetsStudent(drill, student)) throw new FormError('This drill is not set for this student.');
}

export async function markDrillDone(drillId: string, studentId: string, fd: FormData) {
  return run(async () => {
    await check(drillId, studentId);
    const note = text(fd, 'note', { label: 'Note', max: 300 });
    await db.drillCompletion.upsert({
      where: { drillId_studentId: { drillId, studentId } },
      create: { drillId, studentId, note },
      update: { note, doneAt: new Date() },
    });
    revalidatePath('/', 'layout');
    return 'Marked as done. Well done! 👏';
  });
}

export async function undoDrillDone(drillId: string, studentId: string) {
  return run(async () => {
    await check(drillId, studentId);
    await db.drillCompletion.deleteMany({ where: { drillId, studentId } });
    revalidatePath('/', 'layout');
    return 'Marked as not done';
  });
}
