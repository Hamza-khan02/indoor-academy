'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin, actionUser } from '@/lib/auth';
import { AGE_GROUPS, SQUAD_ROLES, TOURNAMENT_STATUS } from '@/lib/constants';
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

/** Saves the selected squad of a tournament. Students left out are removed from it. */
export async function saveSquad(tournamentId: string, fd: FormData) {
  return run(async () => {
    await actionUser();
    const tournament = await db.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, name: true } });
    if (!tournament) throw new FormError('This tournament no longer exists.');
    let picks: { studentId: string; role: string }[];
    try {
      picks = JSON.parse(String(fd.get('squad') ?? '[]'));
      if (!Array.isArray(picks)) throw new Error();
    } catch {
      throw new FormError('The squad could not be read. Please try again.');
    }
    if (picks.length > 30) throw new FormError('A squad can have at most 30 players.');
    const ids = picks.map((p) => String(p.studentId));
    if (new Set(ids).size !== ids.length) throw new FormError('A player is selected twice.');
    for (const p of picks) if (!(p.role in SQUAD_ROLES)) throw new FormError('Choose a valid role for every player.');
    for (const role of ['CAPTAIN', 'VICE_CAPTAIN']) {
      if (picks.filter((p) => p.role === role).length > 1) throw new FormError(`Only one ${SQUAD_ROLES[role].toLowerCase()} can be chosen.`);
    }
    if ((await db.student.count({ where: { id: { in: ids } } })) !== ids.length) throw new FormError('One of the players no longer exists. Refresh the page.');

    await db.$transaction([
      db.tournamentSquad.deleteMany({ where: { tournamentId, studentId: { notIn: ids } } }),
      ...picks.map((p) =>
        db.tournamentSquad.upsert({
          where: { tournamentId_studentId: { tournamentId, studentId: p.studentId } },
          create: { tournamentId, studentId: p.studentId, role: p.role },
          update: { role: p.role },
        }),
      ),
    ]);
    revalidatePath('/', 'layout');
    return `Squad saved: ${picks.length} players for ${tournament.name}`;
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
