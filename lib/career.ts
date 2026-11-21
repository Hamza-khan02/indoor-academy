// Loads everything needed for a student's career page / card.
import { db } from './db';
import { MATCH_TYPES } from './constants';
import { careerStats, type StatRow } from './cricket';
import { addDays, formatDate, todayISO } from './dates';
import { percent } from './format';
import { attended } from './queries';
import { photoUrl } from './photos';
import { groupStats, milestones, performanceScore, ranks, seasonOf, type CareerRow } from './career-calc';

export async function loadCareer(studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      batch: { select: { id: true, name: true } },
      branch: { select: { name: true } },
      matchStats: { include: { match: { select: { id: true, date: true, opponent: true, matchType: true, result: true, createdAt: true } } } },
      assessments: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!student) return null;

  const rows = [...student.matchStats].sort((a, b) => a.match.date.localeCompare(b.match.date) || a.match.createdAt.getTime() - b.match.createdAt.getTime());
  const career = careerStats(rows);
  const seasons = groupStats(rows as CareerRow[], (r) => seasonOf(r.match.date)).sort((a, b) => b.key.localeCompare(a.key));
  const types = groupStats(rows as CareerRow[], (r) => r.match.matchType)
    .map((g) => ({ ...g, label: MATCH_TYPES[g.key] ?? g.key }))
    .sort((a, b) => b.matches - a.matches);

  // Attendance, last 90 days
  const since = addDays(todayISO(), -89);
  const attendance = await db.attendance.findMany({ where: { studentId, date: { gte: since } }, select: { status: true } });
  const attendancePct = percent(attendance.filter((a) => attended(a.status)).length, attendance.length);

  const latestRating = student.assessments[student.assessments.length - 1] ?? null;
  const score = performanceScore({ latestRating, attendancePct, rows });

  // Rank within the batch (or age group when the student has no batch), current students only.
  const peerWhere = student.batchId ? { batchId: student.batchId } : { ageGroup: student.ageGroup };
  const peerStudents = await db.student.findMany({ where: { ...peerWhere, OR: [{ status: { not: 'INACTIVE' } }, { id: studentId }] }, select: { id: true } });
  const peerRows = await db.playerMatchStat.findMany({ where: { studentId: { in: peerStudents.map((p) => p.id) } } });
  const peers = new Map<string, StatRow[]>(peerStudents.map((p) => [p.id, []]));
  for (const r of peerRows) peers.get(r.studentId)?.push(r);
  const rankGroup = student.batch ? student.batch.name : `${student.ageGroup} players`;

  return {
    student: {
      id: student.id,
      name: student.name,
      ageGroup: student.ageGroup,
      playingRole: student.playingRole,
      batchName: student.batch?.name ?? null,
      branchName: student.branch.name,
      joinedOn: student.joinedOn,
      photo: photoUrl(student),
    },
    career,
    seasons,
    types,
    milestones: milestones(rows as CareerRow[]).reverse(), // newest first
    ranks: ranks(student.id, peers),
    rankGroup,
    attendance: { pct: attendancePct, sessions: attendance.length },
    latestRating: latestRating ? { date: latestRating.date, batting: latestRating.batting, bowling: latestRating.bowling, fielding: latestRating.fielding, fitness: latestRating.fitness } : null,
    score,
    charts: {
      perMatch: rows.map((r) => ({
        label: formatDate(r.match.date).slice(0, -5),
        opponent: r.match.opponent,
        runs: r.batted ? r.runs : null,
        notOut: r.notOut,
        wickets: r.ballsBowled > 0 ? r.wickets : null,
      })),
      ratings: student.assessments.map((a) => ({
        label: formatDate(a.date).slice(0, -5),
        average: Math.round(((a.batting + a.bowling + a.fielding + a.fitness) / 4) * 10) / 10,
        batting: a.batting,
        bowling: a.bowling,
        fielding: a.fielding,
        fitness: a.fitness,
      })),
    },
  };
}

export type Career = NonNullable<Awaited<ReturnType<typeof loadCareer>>>;
