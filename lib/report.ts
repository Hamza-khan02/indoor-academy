// Monthly progress report: everything about one student in one month.
import { db } from './db';
import { addMonths, currentMonth, formatDate, monthLabel } from './dates';
import { inr, percent } from './format';
import { attended } from './queries';
import { careerStats, matchLine } from './cricket';
import { photoUrl } from './photos';
import { whatsappUrl } from './messages';

/** 'YYYY-MM' that is a real month and not in the future. */
export function isValidMonth(m: string | undefined | null): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m <= currentMonth();
}

/** The last n months ending with the current one, newest first. */
export function recentMonths(n: number) {
  const now = currentMonth();
  return Array.from({ length: n }, (_, i) => addMonths(now, -i));
}

const dayRange = (m: string) => ({ gte: `${m}-01`, lte: `${m}-31` });
const monthStart = (m: string) => new Date(`${m}-01T00:00:00+05:30`);

type Scores = { batting: number; bowling: number; fielding: number; fitness: number };
const avg = (a: Scores) => Math.round(((a.batting + a.bowling + a.fielding + a.fitness) / 4) * 10) / 10;

export async function loadMonthlyReport(studentId: string, month: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: { batch: { include: { coach: { select: { name: true } } } }, branch: { select: { name: true } } },
  });
  if (!student) return null;
  const prev = addMonths(month, -1);
  const from = monthStart(month);
  const to = monthStart(addMonths(month, 1));

  const [att, prevAtt, ratings, stats, drills, payments, comment, squads] = await Promise.all([
    db.attendance.findMany({ where: { studentId, date: dayRange(month) }, orderBy: { date: 'asc' }, select: { date: true, status: true } }),
    db.attendance.findMany({ where: { studentId, date: dayRange(prev) }, select: { status: true } }),
    db.assessment.findMany({ where: { studentId, date: { lte: `${month}-31` } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 2 }),
    db.playerMatchStat.findMany({ where: { studentId, match: { date: dayRange(month) } }, include: { match: { select: { date: true, opponent: true, result: true } } } }),
    db.drill.findMany({
      where: {
        OR: [...(student.batchId ? [{ batchId: student.batchId }] : []), { students: { some: { studentId } } }],
        AND: [{ OR: [{ dueOn: dayRange(month) }, { createdAt: { gte: from, lt: to } }] }],
      },
      orderBy: { createdAt: 'asc' },
      include: { completions: { where: { studentId }, select: { doneAt: true, note: true } } },
    }),
    db.feePayment.findMany({ where: { studentId, forMonth: month }, select: { amount: true } }),
    db.progressComment.findUnique({ where: { studentId_month: { studentId, month } } }),
    db.tournamentSquad.findMany({ where: { studentId, addedAt: { gte: from, lt: to } }, include: { tournament: { select: { name: true, startDate: true } } } }),
  ]);

  const count = (s: string) => att.filter((a) => a.status === s).length;
  const latest = ratings[0] ?? null;
  const previousRating = ratings[1] ?? null;
  const fee = student.batch?.monthlyFee ?? 0;
  const paid = payments.reduce((t, p) => t + p.amount, 0);
  const matchRows = [...stats].sort((a, b) => a.match.date.localeCompare(b.match.date));

  return {
    month,
    monthLabel: monthLabel(month),
    student: {
      id: student.id,
      name: student.name,
      ageGroup: student.ageGroup,
      playingRole: student.playingRole,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      batchName: student.batch?.name ?? null,
      coachName: student.batch?.coach?.name ?? null,
      branchName: student.branch.name,
      photo: photoUrl(student),
    },
    attendance: {
      days: att,
      present: count('PRESENT'),
      late: count('LATE'),
      absent: count('ABSENT'),
      total: att.length,
      pct: percent(att.filter((a) => attended(a.status)).length, att.length),
      prevPct: percent(prevAtt.filter((a) => attended(a.status)).length, prevAtt.length),
    },
    rating: latest
      ? {
          date: latest.date,
          inMonth: latest.date.startsWith(month),
          scores: { batting: latest.batting, bowling: latest.bowling, fielding: latest.fielding, fitness: latest.fitness },
          average: avg(latest),
          previousAverage: previousRating ? avg(previousRating) : null,
          previous: previousRating ? { batting: previousRating.batting, bowling: previousRating.bowling, fielding: previousRating.fielding, fitness: previousRating.fitness } : null,
          notes: latest.notes,
          coachName: latest.coachName,
        }
      : null,
    matches: {
      totals: careerStats(matchRows),
      list: matchRows.map((r) => ({ date: r.match.date, opponent: r.match.opponent, result: r.match.result, line: matchLine(r) })),
    },
    drills: {
      list: drills.map((d) => ({ title: d.title, category: d.category, done: d.completions.length > 0, note: d.completions[0]?.note ?? null })),
      done: drills.filter((d) => d.completions.length > 0).length,
      total: drills.length,
    },
    fee: { fee, paid, due: Math.max(0, fee - paid) },
    selections: squads.map((s) => ({ name: s.tournament.name, role: s.role, startDate: s.tournament.startDate })),
    comment: comment ? { text: comment.comment, author: comment.author } : null,
  };
}

export type MonthlyReport = NonNullable<Awaited<ReturnType<typeof loadMonthlyReport>>>;

/** Short WhatsApp summary of a report for the parent. */
export function reportShareText(r: MonthlyReport, academyName: string, publicUrl: string) {
  const lines = [
    `Namaste ${r.student.guardianName || 'Sir/Madam'}, here is ${r.student.name}'s progress report for *${r.monthLabel}* from ${academyName}:`,
    '',
    `• Attendance: ${r.attendance.pct === null ? 'not recorded' : `${r.attendance.pct}% (${r.attendance.present + r.attendance.late} of ${r.attendance.total} sessions)`}`,
  ];
  if (r.rating) lines.push(`• Coach rating: ${r.rating.average}/10${r.rating.inMonth ? '' : ` (from ${formatDate(r.rating.date)})`}`);
  if (r.matches.totals.matches) lines.push(`• Matches: ${r.matches.totals.matches} · ${r.matches.totals.runs} runs · ${r.matches.totals.wickets} wickets`);
  if (r.drills.total) lines.push(`• Practice drills done: ${r.drills.done} of ${r.drills.total}`);
  for (const s of r.selections) lines.push(`• 🏆 Selected for ${s.name}`);
  if (r.fee.fee) lines.push(`• Fee for ${r.monthLabel}: ${r.fee.due ? `${inr(r.fee.due)} due` : 'paid ✓'}`);
  if (r.comment) lines.push('', `Coach's note: ${r.comment.text}`);
  if (publicUrl) lines.push('', `Full report in the parent app: ${publicUrl.replace(/\/+$/, '')}/parent/login`);
  return lines.join('\n');
}

export function reportWhatsappUrl(r: MonthlyReport, academyName: string, publicUrl: string) {
  return whatsappUrl(r.student.guardianPhone, reportShareText(r, academyName, publicUrl));
}
