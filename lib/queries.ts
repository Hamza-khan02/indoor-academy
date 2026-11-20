import { db } from './db';
import { percent } from './format';

export const attended = (status: string) => status === 'PRESENT' || status === 'LATE';

/** Branches, active batches and active coaches for form dropdowns. */
export async function formOptions() {
  const [branches, batches, coaches] = await Promise.all([
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.batch.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, ageGroup: true, branchId: true, monthlyFee: true, branch: { select: { name: true } } },
    }),
    db.coach.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return { branches, batches, coaches };
}
export type FormOptions = Awaited<ReturnType<typeof formOptions>>;

/** Attendance % per student since a date (PRESENT and LATE count as attended). */
export async function attendanceByStudent(studentIds: string[], since: string) {
  const result = new Map<string, number | null>();
  if (studentIds.length === 0) return result;
  const rows = await db.attendance.groupBy({
    by: ['studentId', 'status'],
    where: { studentId: { in: studentIds }, date: { gte: since } },
    _count: { _all: true },
  });
  const totals = new Map<string, { a: number; t: number }>();
  for (const r of rows) {
    const cur = totals.get(r.studentId) ?? { a: 0, t: 0 };
    cur.t += r._count._all;
    if (attended(r.status)) cur.a += r._count._all;
    totals.set(r.studentId, cur);
  }
  for (const id of studentIds) {
    const t = totals.get(id);
    result.set(id, t ? percent(t.a, t.t) : null);
  }
  return result;
}

/** Attendance % per day for the given dates (null when nothing was marked that day). */
export async function attendanceByDay(dates: string[], where: { batchId?: string } = {}) {
  const rows = await db.attendance.groupBy({
    by: ['date', 'status'],
    where: { date: { gte: dates[0], lte: dates[dates.length - 1] }, ...where },
    _count: { _all: true },
  });
  const byDay = new Map<string, { a: number; t: number }>();
  for (const r of rows) {
    const cur = byDay.get(r.date) ?? { a: 0, t: 0 };
    cur.t += r._count._all;
    if (attended(r.status)) cur.a += r._count._all;
    byDay.set(r.date, cur);
  }
  return dates.map((date) => {
    const d = byDay.get(date);
    return { date, pct: d ? percent(d.a, d.t) : null, attended: d?.a ?? 0, total: d?.t ?? 0 };
  });
}
