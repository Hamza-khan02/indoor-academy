'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin, actionUser } from '@/lib/auth';
import { AGE_GROUPS, TOURNAMENT_STATUS } from '@/lib/constants';
import { FormError, date, oneOf, run, text } from '@/lib/form';

function parseTournament(fd: FormData) {
  const startDate = date(fd, 'startDate', { required: true, label: 'Start date' })!;
  const endDate = date(fd, 'endDate', { label: 'End date' });
  if (endDate && endDate < startDate) throw new FormError('End date cannot be before the start date.');
  return {
    name: text(fd, 'name', { required: true, label: 'Tournament name', max: 100 }),
    startDate,
    endDate,
    venue: text(fd, 'venue', { label: 'Venue', max: 100 }),
    ageGroup: oneOf(fd, 'ageGroup', AGE_GROUPS, { label: 'Age group' }),
    status: oneOf(fd, 'status', Object.keys(TOURNAMENT_STATUS), { required: true, label: 'Status' })!,
    result: text(fd, 'result', { label: 'Result / notes', max: 500 }),
  };
}

export async function createTournament(fd: FormData) {
  return run(async () => {
    await actionUser();
    const data = parseTournament(fd);
    await db.tournament.create({ data });
    revalidatePath('/tournaments');
    return `${data.name} added`;
  });
}

export async function updateTournament(id: string, fd: FormData) {
  return run(async () => {
    await actionUser();
    const data = parseTournament(fd);
    await db.tournament.update({ where: { id }, data });
    revalidatePath('/tournaments');
    return `${data.name} updated`;
  });
}

export async function deleteTournament(id: string) {
  return run(async () => {
    await actionAdmin();
    const t = await db.tournament.delete({ where: { id } });
    revalidatePath('/tournaments');
    return `${t.name} deleted`;
  });
}
