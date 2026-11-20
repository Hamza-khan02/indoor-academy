'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin, actionUser } from '@/lib/auth';
import { todayISO } from '@/lib/dates';
import { FormError, date, int, run, text } from '@/lib/form';

export async function addAssessment(fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const studentId = text(fd, 'studentId', { required: true, label: 'Student' });
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) throw new FormError('Choose a valid student.');
    const day = date(fd, 'date', { required: true, label: 'Date' })!;
    if (day > todayISO()) throw new FormError('Assessment date cannot be in the future.');
    const score = (key: string, label: string) => int(fd, key, { required: true, label, min: 1, max: 10 })!;

    await db.assessment.create({
      data: {
        studentId,
        date: day,
        batting: score('batting', 'Batting'),
        bowling: score('bowling', 'Bowling'),
        fielding: score('fielding', 'Fielding'),
        fitness: score('fitness', 'Fitness'),
        notes: text(fd, 'notes', { label: 'Notes', max: 500 }),
        coachName: user.name,
      },
    });
    revalidatePath('/', 'layout');
    return `Assessment saved for ${student.name}`;
  });
}

export async function deleteAssessment(id: string) {
  return run(async () => {
    await actionAdmin();
    await db.assessment.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return 'Assessment deleted';
  });
}
