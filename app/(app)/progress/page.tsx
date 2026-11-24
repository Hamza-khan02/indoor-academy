import Link from 'next/link';
import { FileText, MessageSquarePlus, Pencil } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { addMonths, currentMonth, monthLabel, todayISO } from '@/lib/dates';
import { percent } from '@/lib/format';
import { attended } from '@/lib/queries';
import { photoUrl } from '@/lib/photos';
import { isValidMonth, recentMonths } from '@/lib/report';
import { FormModal } from '@/components/FormModal';
import { AttendanceBar, Avatar, Empty, PageHeader } from '@/components/ui';
import { saveProgressComment } from './actions';

/** Early in a month, reports are usually for the month that just ended. */
function defaultMonth() {
  return Number(todayISO().slice(8)) <= 7 ? addMonths(currentMonth(), -1) : currentMonth();
}

export default async function ProgressPage(props: { searchParams: Promise<{ month?: string; batch?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser();
  const month = isValidMonth(searchParams.month) ? searchParams.month : defaultMonth();
  const range = { gte: `${month}-01`, lte: `${month}-31` };
  const batches = await db.batch.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  const batchId = batches.some((b) => b.id === searchParams.batch) ? searchParams.batch : undefined;

  const students = await db.student.findMany({
    where: { status: { not: 'INACTIVE' }, ...(batchId ? { batchId } : {}) },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, ageGroup: true, photoUpdatedAt: true, batch: { select: { name: true } } },
  });
  const ids = students.map((s) => s.id);
  const [att, rated, matches, comments, sent] = await Promise.all([
    db.attendance.groupBy({ by: ['studentId', 'status'], where: { studentId: { in: ids }, date: range }, _count: { _all: true } }),
    db.assessment.findMany({ where: { studentId: { in: ids }, date: range }, select: { studentId: true } }),
    db.playerMatchStat.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, match: { date: range } }, _count: { _all: true } }),
    db.progressComment.findMany({ where: { studentId: { in: ids }, month } }),
    db.reminder.findMany({ where: { studentId: { in: ids }, kind: 'REPORT', ref: month }, select: { studentId: true } }),
  ]);
  const pctOf = (id: string) => {
    const rows = att.filter((r) => r.studentId === id);
    const total = rows.reduce((t, r) => t + r._count._all, 0);
    return percent(rows.filter((r) => attended(r.status)).reduce((t, r) => t + r._count._all, 0), total);
  };
  const ratedSet = new Set(rated.map((r) => r.studentId));
  const matchCount = new Map(matches.map((m) => [m.studentId, m._count._all]));
  const commentOf = new Map(comments.map((c) => [c.studentId, c]));
  const sentSet = new Set(sent.map((s) => s.studentId));

  return (
    <>
      <PageHeader title="Progress reports" subtitle="A monthly report for every student: attendance, coach rating, matches, drills, fees and your comment." />
      <form className="filters panel" method="get">
        <label className="inline">Month
          <select name="month" defaultValue={month}>
            {recentMonths(12).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <label className="inline">Batch
          <select name="batch" defaultValue={batchId ?? ''}>
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <button className="secondary-btn">Show</button>
        <span className="muted small-note">{comments.length}/{students.length} comments written · {sent.length} sent</span>
      </form>

      <article className="panel padded">
        {students.length === 0 ? <Empty title="No students" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>STUDENT</th><th>ATTENDANCE</th><th>RATED</th><th>MATCHES</th><th>COACH COMMENT</th><th>SENT</th><th /></tr></thead>
              <tbody>
                {students.map((s) => {
                  const c = commentOf.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td><Link href={`/students/${s.id}`} className="player-cell"><Avatar name={s.name} small photo={photoUrl(s)} /><div><b>{s.name}</b><small>{s.ageGroup}{s.batch ? ` · ${s.batch.name}` : ''}</small></div></Link></td>
                      <td><AttendanceBar pct={pctOf(s.id)} /></td>
                      <td>{ratedSet.has(s.id) ? <span className="c-present">✓</span> : <span className="muted">—</span>}</td>
                      <td>{matchCount.get(s.id) ?? 0}</td>
                      <td className="wrap">
                        <FormModal
                          title={`Comment for ${s.name}`}
                          eyebrow={monthLabel(month).toUpperCase()}
                          description="Shown on the report and in the WhatsApp summary. Leave empty to remove."
                          trigger={c ? <><Pencil size={12} /> {c.comment.length > 40 ? `${c.comment.slice(0, 40)}…` : c.comment}</> : <><MessageSquarePlus size={13} /> Write</>}
                          triggerClassName={`text-btn comment-btn ${c ? 'has' : ''}`}
                          action={saveProgressComment.bind(null, s.id, month)}
                          submitLabel="Save comment"
                        >
                          <label>Coach&apos;s comment<textarea name="comment" rows={5} maxLength={1000} defaultValue={c?.comment ?? ''} placeholder="How the month went, strengths, what to work on next…" /></label>
                        </FormModal>
                      </td>
                      <td>{sentSet.has(s.id) ? <span className="c-present">✓</span> : <span className="muted">—</span>}</td>
                      <td><Link className="secondary-btn small-btn" href={`/report/${s.id}?month=${month}`} target="_blank"><FileText size={13} /> Open report</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}
