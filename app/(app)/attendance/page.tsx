import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatDate, formatTime, todayISO, weekdayShort } from '@/lib/dates';
import { absenceNoticeUrl, getMessageSettings } from '@/lib/settings';
import { Empty, PageHeader, Panel } from '@/components/ui';
import { AttendanceSheet } from './AttendanceSheet';
import { saveAttendance } from './actions';

export default async function AttendancePage({ searchParams }: { searchParams: { date?: string; batch?: string } }) {
  await requireUser();
  const today = todayISO();
  const valid = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) && searchParams.date <= today;
  const day = valid ? searchParams.date! : today;
  const weekday = weekdayShort(day);

  const batches = await db.batch.findMany({
    where: { active: true },
    orderBy: { startTime: 'asc' },
    include: {
      branch: { select: { name: true } },
      coach: { select: { name: true } },
      students: {
        where: { status: { not: 'INACTIVE' } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, ageGroup: true, playingRole: true, guardianName: true, guardianPhone: true },
      },
    },
  });

  const studentIds = batches.flatMap((b) => b.students.map((s) => s.id));
  const [records, notices, settings] = await Promise.all([
    db.attendance.findMany({ where: { date: day, studentId: { in: studentIds } }, select: { studentId: true, status: true } }),
    db.reminder.findMany({ where: { kind: 'ABSENT', ref: day, studentId: { in: studentIds } }, select: { studentId: true } }),
    getMessageSettings(),
  ]);
  const statusOf = new Map(records.map((r) => [r.studentId, r.status]));
  const notified = new Set(notices.map((n) => n.studentId));

  const scheduled = batches.filter((b) => b.days.split(',').includes(weekday));
  const selected = batches.find((b) => b.id === searchParams.batch) ?? scheduled[0] ?? batches[0];

  return (
    <>
      <PageHeader title="Attendance" subtitle="Pick a batch and date, mark each player, then save." />
      <form className="filters panel" method="get">
        <label className="inline">Date <input type="date" name="date" defaultValue={day} max={today} /></label>
        {selected && <input type="hidden" name="batch" value={selected.id} />}
        <button className="secondary-btn">Go</button>
        {day !== today && <Link className="text-btn" href="/attendance">Back to today</Link>}
      </form>

      {batches.length === 0 ? (
        <article className="panel padded"><Empty title="No active batches">Create a batch and add students to it before marking attendance. <Link href="/batches">Go to batches</Link></Empty></article>
      ) : (
        <div className="sidebar-layout">
          <Panel title={formatDate(day)} subtitle={scheduled.length ? `${scheduled.length} batch${scheduled.length > 1 ? 'es' : ''} scheduled on ${weekday}` : `No batches scheduled on ${weekday}`}>
            <ul className="batch-pick">
              {batches.map((b) => {
                const done = b.students.filter((s) => statusOf.has(s.id)).length;
                const isScheduled = scheduled.includes(b);
                return (
                  <li key={b.id}>
                    <Link href={`/attendance?date=${day}&batch=${b.id}`} className={b.id === selected?.id ? 'active' : ''}>
                      <div className="stack">
                        <b>{b.name}</b>
                        <small className="muted">{formatTime(b.startTime)} · {b.branch.name}{isScheduled ? '' : ' · not scheduled'}</small>
                      </div>
                      <span className={`progress-pill ${b.students.length && done === b.students.length ? 'done' : ''}`}>{done}/{b.students.length}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {selected && (
            <Panel title={`${selected.name} · ${selected.ageGroup}`} subtitle={`${formatTime(selected.startTime)} – ${formatTime(selected.endTime)}${selected.coach ? ` · Coach ${selected.coach.name}` : ''}${selected.venue ? ` · ${selected.venue}` : ''}`}>
              {selected.students.length === 0 ? (
                <Empty title="No students in this batch">Assign students to this batch from the Students page.</Empty>
              ) : (
                <AttendanceSheet
                  key={`${selected.id}-${day}`}
                  day={day}
                  students={selected.students.map((s) => ({
                    id: s.id,
                    name: s.name,
                    detail: [s.ageGroup, s.playingRole].filter(Boolean).join(' · '),
                    status: statusOf.get(s.id) ?? '',
                    noticeUrl: absenceNoticeUrl(settings, { ...s, batchName: selected.name }, day),
                    notified: notified.has(s.id),
                  }))}
                  action={saveAttendance.bind(null, selected.id, day)}
                />
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
