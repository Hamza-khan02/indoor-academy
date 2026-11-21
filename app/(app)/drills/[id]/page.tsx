import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatDate, todayISO } from '@/lib/dates';
import { DRILL_CATEGORIES } from '@/lib/drills';
import { photoUrl } from '@/lib/photos';
import { Avatar, Empty, Panel } from '@/components/ui';

/** Who has done a drill and who hasn't, with their notes. */
export default async function DrillPage({ params }: { params: { id: string } }) {
  await requireUser();
  const d = await db.drill.findUnique({
    where: { id: params.id },
    include: {
      batch: { select: { name: true, students: { where: { status: { not: 'INACTIVE' } }, select: { id: true, name: true, photoUpdatedAt: true } } } },
      students: { select: { student: { select: { id: true, name: true, photoUpdatedAt: true } } } },
      completions: true,
    },
  });
  if (!d) notFound();
  const targets = (d.batchId ? d.batch?.students ?? [] : d.students.map((s) => s.student)).sort((a, b) => a.name.localeCompare(b.name));
  const doneBy = new Map(d.completions.map((c) => [c.studentId, c]));
  const done = targets.filter((t) => doneBy.has(t.id));
  const pending = targets.filter((t) => !doneBy.has(t.id));
  const c = DRILL_CATEGORIES[d.category] ?? DRILL_CATEGORIES.OTHER;

  return (
    <>
      <Link href="/drills" className="back-link"><ArrowLeft size={14} /> All drills</Link>
      <div className="match-head panel padded">
        <div>
          <span className="eyebrow">{c.emoji} {c.label.toUpperCase()} DRILL{d.dueOn ? ` · DUE ${formatDate(d.dueOn).toUpperCase()}` : ''}</span>
          <h1>{d.title}</h1>
          <p className="muted">{d.batchId ? `Batch: ${d.batch?.name}` : `${targets.length} chosen students`} · set {formatDate(todayISO(d.createdAt))}{d.createdBy ? ` by ${d.createdBy}` : ''}</p>
          <p className="notice-body">{d.instructions}</p>
          {d.videoUrl && <a className="secondary-btn small-btn" href={d.videoUrl} target="_blank" rel="noopener noreferrer"><PlayCircle size={14} /> Watch video</a>}
        </div>
        <div className="match-side"><span className={`progress-pill big ${targets.length && done.length === targets.length ? 'done' : ''}`}>{done.length}/{targets.length} done</span></div>
      </div>
      <div className="two-col">
        <Panel title={`Done (${done.length})`}>
          {done.length === 0 ? <Empty title="Nobody yet" /> : (
            <ul className="user-list">
              {done.map((s) => {
                const comp = doneBy.get(s.id)!;
                return (
                  <li key={s.id}>
                    <Avatar name={s.name} small photo={photoUrl(s)} />
                    <div className="stack"><Link href={`/students/${s.id}`}><b>{s.name}</b></Link><small className="muted">{formatDate(todayISO(comp.doneAt))}{comp.note ? ` · “${comp.note}”` : ''}</small></div>
                    <span className="c-present">✓</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title={`Not done yet (${pending.length})`}>
          {pending.length === 0 ? <Empty title="Everyone has done it 🎉" /> : (
            <ul className="user-list">
              {pending.map((s) => (
                <li key={s.id}>
                  <Avatar name={s.name} small photo={photoUrl(s)} />
                  <div className="stack"><Link href={`/students/${s.id}`}><b>{s.name}</b></Link></div>
                  <span className="muted">⏳</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
