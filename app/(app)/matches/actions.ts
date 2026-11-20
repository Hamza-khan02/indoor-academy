'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin, actionUser } from '@/lib/auth';
import { MATCH_RESULTS, MATCH_TYPES } from '@/lib/constants';
import { parseOvers } from '@/lib/cricket';
import { todayISO } from '@/lib/dates';
import { FormError, date, int, oneOf, run, text } from '@/lib/form';

async function parseMatch(fd: FormData) {
  const day = date(fd, 'date', { required: true, label: 'Match date' })!;
  if (day > todayISO()) throw new FormError('Match date cannot be in the future. Add upcoming events under Tournaments.');
  const tournamentId = text(fd, 'tournamentId');
  if (tournamentId && !(await db.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } }))) throw new FormError('Choose a valid tournament.');
  return {
    date: day,
    opponent: text(fd, 'opponent', { required: true, label: 'Opponent', max: 80 }),
    venue: text(fd, 'venue', { label: 'Venue', max: 80 }),
    matchType: oneOf(fd, 'matchType', Object.keys(MATCH_TYPES), { required: true, label: 'Match type' })!,
    overs: int(fd, 'overs', { label: 'Overs per side', min: 1, max: 50 }),
    result: oneOf(fd, 'result', Object.keys(MATCH_RESULTS), { label: 'Result' }),
    ourScore: text(fd, 'ourScore', { label: 'Our score', max: 30 }),
    opponentScore: text(fd, 'opponentScore', { label: 'Opponent score', max: 30 }),
    notes: text(fd, 'notes', { label: 'Notes', max: 500 }),
    tournamentId,
  };
}

export async function createMatch(fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const data = await parseMatch(fd);
    await db.match.create({ data: { ...data, createdBy: user.name } });
    revalidatePath('/', 'layout');
    return `Match vs ${data.opponent} added. Open it to fill in the scorecard.`;
  });
}

export async function updateMatch(id: string, fd: FormData) {
  return run(async () => {
    await actionUser();
    const data = await parseMatch(fd);
    await db.match.update({ where: { id }, data });
    revalidatePath('/', 'layout');
    return `Match vs ${data.opponent} updated`;
  });
}

export async function deleteMatch(id: string) {
  return run(async () => {
    await actionAdmin();
    const m = await db.match.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return `Match vs ${m.opponent} and its scorecard deleted`;
  });
}

type RowInput = Record<string, unknown>;

function num(row: RowInput, key: string, label: string, max: number) {
  const raw = row[key];
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new FormError(`${label} must be a whole number from 0 to ${max}.`);
  return n;
}

/** Saves the whole scorecard of a match. Players left out of the list are removed from it. */
export async function saveScorecard(matchId: string, fd: FormData) {
  return run(async () => {
    await actionUser();
    const match = await db.match.findUnique({ where: { id: matchId }, select: { id: true } });
    if (!match) throw new FormError('This match no longer exists.');
    let rows: RowInput[];
    try {
      rows = JSON.parse(String(fd.get('rows') ?? '[]'));
      if (!Array.isArray(rows)) throw new Error();
    } catch {
      throw new FormError('The scorecard could not be read. Please try again.');
    }
    if (rows.length > 30) throw new FormError('A scorecard can have at most 30 players.');

    const ids = rows.map((r) => String(r.studentId ?? ''));
    if (new Set(ids).size !== ids.length) throw new FormError('A player is listed twice.');
    const students = await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameOf = new Map(students.map((s) => [s.id, s.name]));
    if (students.length !== ids.length) throw new FormError('One of the players no longer exists. Refresh the page.');

    const data = rows.map((r) => {
      const who = nameOf.get(String(r.studentId))!;
      const bat = String(r.bat ?? 'DNB');
      if (!['DNB', 'OUT', 'NOT_OUT'].includes(bat)) throw new FormError(`${who}: choose how they batted.`);
      const batted = bat !== 'DNB';
      const runs = num(r, 'runs', `${who}: runs`, 500);
      const balls = num(r, 'balls', `${who}: balls faced`, 600);
      const fours = num(r, 'fours', `${who}: 4s`, 100);
      const sixes = num(r, 'sixes', `${who}: 6s`, 100);
      if (!batted && (runs || balls || fours || sixes)) throw new FormError(`${who}: batting figures entered but marked "Did not bat".`);
      if (fours * 4 + sixes * 6 > runs) throw new FormError(`${who}: 4s and 6s add up to more than the runs scored.`);
      const ballsBowled = parseOvers(String(r.overs ?? ''));
      if (ballsBowled === null || ballsBowled > 300) throw new FormError(`${who}: overs must look like 4 or 3.2 (the part after the dot is 0–5).`);
      const maidens = num(r, 'maidens', `${who}: maidens`, 50);
      const runsConceded = num(r, 'runsConceded', `${who}: runs conceded`, 500);
      const wickets = num(r, 'wickets', `${who}: wickets`, 10);
      if (!ballsBowled && (maidens || runsConceded || wickets)) throw new FormError(`${who}: bowling figures entered without overs.`);
      if (maidens * 6 > ballsBowled) throw new FormError(`${who}: more maidens than overs bowled.`);
      return {
        studentId: String(r.studentId),
        batted,
        notOut: bat === 'NOT_OUT',
        runs, balls, fours, sixes,
        ballsBowled, maidens, runsConceded, wickets,
        catches: num(r, 'catches', `${who}: catches`, 10),
        stumpings: num(r, 'stumpings', `${who}: stumpings`, 10),
        runOuts: num(r, 'runOuts', `${who}: run outs`, 10),
      };
    });

    await db.$transaction([
      db.playerMatchStat.deleteMany({ where: { matchId, studentId: { notIn: ids } } }),
      ...data.map((d) =>
        db.playerMatchStat.upsert({
          where: { matchId_studentId: { matchId, studentId: d.studentId } },
          create: { matchId, ...d },
          update: d,
        }),
      ),
    ]);
    revalidatePath('/', 'layout');
    return `Scorecard saved (${data.length} players)`;
  });
}
