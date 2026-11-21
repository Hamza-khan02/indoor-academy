import Link from 'next/link';
import { Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatDate, todayISO } from '@/lib/dates';
import { DRILL_CATEGORIES, drillShareText } from '@/lib/drills';
import { whatsappShareUrl } from '@/lib/notices';
import { getSettings } from '@/lib/settings';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { CopyButton } from '@/components/CopyButton';
import { Empty, PageHeader } from '@/components/ui';
import { DrillFields } from './DrillFields';
import { createDrill, deleteDrill, updateDrill } from './actions';

export default async function DrillsPage() {
  const user = await requireUser();
  const today = todayISO();
  const [drills, batches, students, settings] = await Promise.all([
    db.drill.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        batch: { select: { name: true, students: { where: { status: { not: 'INACTIVE' } }, select: { id: true } } } },
        students: { select: { studentId: true } },
        completions: { select: { studentId: true } },
      },
    }),
    db.batch.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, branch: { select: { name: true } } } }),
    db.student.findMany({ where: { status: { not: 'INACTIVE' } }, orderBy: { name: 'asc' }, select: { id: true, name: true, batch: { select: { name: true } } } }),
    getSettings(),
  ]);

  const addButton = (
    <FormModal title="Set a drill" eyebrow="DRILLS & HOMEWORK" description="Students see it in the parent app and can mark it done." trigger={<><Plus size={17} /> New drill</>} action={createDrill} submitLabel="Post drill">
      <DrillFields batches={batches} students={students} />
    </FormModal>
  );

  return (
    <>
      <PageHeader title="Drills & homework" subtitle="Practice for students to do at home. They mark it done in the parent app." actions={addButton} />
      {drills.length === 0 ? (
        <article className="panel padded"><Empty title="No drills yet" action={addButton}>Set a drill for a whole batch or for chosen students, with a video link if you like.</Empty></article>
      ) : (
        <div className="notice-list">
          {drills.map((d) => {
            const targets = d.batchId ? d.batch?.students.map((s) => s.id) ?? [] : d.students.map((s) => s.studentId);
            const done = d.completions.filter((c) => targets.includes(c.studentId)).length;
            const c = DRILL_CATEGORIES[d.category] ?? DRILL_CATEGORIES.OTHER;
            const overdue = d.dueOn && d.dueOn < today;
            const share = drillShareText(d, settings.academyName);
            return (
              <article key={d.id} className="panel padded notice-card">
                <div className="notice-head drill-head">
                  <div>
                    <h3><span aria-hidden>{c.emoji}</span> <Link href={`/drills/${d.id}`}>{d.title}</Link></h3>
                    <p className="muted">
                      {d.batchId ? `Batch: ${d.batch?.name}` : `${targets.length} chosen students`} · set {formatDate(todayISO(d.createdAt))}{d.createdBy ? ` by ${d.createdBy}` : ''}
                      {d.dueOn && <> · <span className={overdue ? 'c-absent' : ''}>{overdue ? 'was due' : 'due'} {formatDate(d.dueOn)}</span></>}
                    </p>
                  </div>
                  <Link href={`/drills/${d.id}`} className={`progress-pill ${targets.length && done === targets.length ? 'done' : ''}`}>{done}/{targets.length} done</Link>
                </div>
                <p className="notice-body">{d.instructions}</p>
                <div className="row-actions end">
                  {d.videoUrl && <a className="secondary-btn small-btn" href={d.videoUrl} target="_blank" rel="noopener noreferrer"><PlayCircle size={14} /> Video</a>}
                  <a className="wa-btn" href={whatsappShareUrl(share)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
                  <CopyButton text={share} />
                  <FormModal title="Edit drill" trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={updateDrill.bind(null, d.id)}>
                    <DrillFields batches={batches} students={students} drill={{ ...d, studentIds: d.students.map((s) => s.studentId) }} />
                  </FormModal>
                  {(user.role === 'ADMIN' || d.createdById === user.id) && (
                    <ConfirmAction action={deleteDrill.bind(null, d.id)} confirmText={`Delete the drill "${d.title}"?`} label="Delete"><Trash2 size={15} /></ConfirmAction>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
