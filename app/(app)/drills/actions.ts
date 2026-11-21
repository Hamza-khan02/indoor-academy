'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionUser } from '@/lib/auth';
import { todayISO } from '@/lib/dates';
import { DRILL_CATEGORIES } from '@/lib/drills';
import { FormError, date, oneOf, run, text } from '@/lib/form';

async function parseDrill(fd: FormData, isNew: boolean) {
  const target = text(fd, 'target', { required: true, label: 'Who should do it' });
  let batchId: string | null = null;
  let studentIds: string[] = [];
  if (target.startsWith('BATCH:')) {
    batchId = target.slice(6);
    if (!(await db.batch.findUnique({ where: { id: batchId }, select: { id: true } }))) throw new FormError('Choose a valid batch.');
  } else if (target === 'STUDENTS') {
    studentIds = [...new Set(fd.getAll('studentIds').map(String).filter(Boolean))];
    if (studentIds.length === 0) throw new FormError('Tick at least one student, or choose a batch.');
    if (studentIds.length > 100) throw new FormError('Choose at most 100 students.');
    if ((await db.student.count({ where: { id: { in: studentIds } } })) !== studentIds.length) throw new FormError('One of the students no longer exists. Refresh the page.');
  } else {
    throw new FormError('Choose who should do this drill.');
  }

  const videoUrl = text(fd, 'videoUrl', { label: 'Video link', max: 300 });
  if (videoUrl) {
    let ok = false;
    try { ok = new URL(videoUrl).protocol === 'https:'; } catch { ok = false; }
    if (!ok) throw new FormError('The video link must start with https:// (e.g. a YouTube link).');
  }
  const dueOn = date(fd, 'dueOn', { label: 'Complete by' });
  if (isNew && dueOn && dueOn < todayISO()) throw new FormError('"Complete by" cannot be in the past.');

  return {
    data: {
      title: text(fd, 'title', { required: true, label: 'Title', max: 120 }),
      instructions: text(fd, 'instructions', { required: true, label: 'Instructions', max: 2000 }),
      videoUrl,
      category: oneOf(fd, 'category', Object.keys(DRILL_CATEGORIES), { label: 'Category' }) ?? 'OTHER',
      dueOn,
      batchId,
    },
    studentIds,
  };
}

export async function createDrill(fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const { data, studentIds } = await parseDrill(fd, true);
    await db.drill.create({
      data: { ...data, createdById: user.id, createdBy: user.name, students: { create: studentIds.map((studentId) => ({ studentId })) } },
    });
    revalidatePath('/', 'layout');
    return 'Drill posted. Students see it in the parent app.';
  });
}

export async function updateDrill(id: string, fd: FormData) {
  return run(async () => {
    await actionUser();
    const { data, studentIds } = await parseDrill(fd, false);
    await db.$transaction([
      db.drillStudent.deleteMany({ where: { drillId: id } }),
      db.drill.update({ where: { id }, data: { ...data, students: { create: studentIds.map((studentId) => ({ studentId })) } } }),
    ]);
    revalidatePath('/', 'layout');
    return 'Drill updated';
  });
}

/** Admins can delete any drill; coaches only their own. */
export async function deleteDrill(id: string) {
  return run(async () => {
    const user = await actionUser();
    const drill = await db.drill.findUnique({ where: { id } });
    if (!drill) throw new FormError('This drill no longer exists.');
    if (user.role !== 'ADMIN' && drill.createdById !== user.id) throw new FormError('Only an administrator or the coach who set it can delete this drill.');
    await db.drill.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return 'Drill deleted';
  });
}
