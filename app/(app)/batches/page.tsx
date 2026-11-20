import Link from 'next/link';
import { Clock3, MapPin, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { AGE_GROUPS, DAYS } from '@/lib/constants';
import { formatTime, todayISO, weekdayShort } from '@/lib/dates';
import { inr } from '@/lib/format';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Empty, PageHeader } from '@/components/ui';
import { createBatch, deleteBatch, updateBatch } from './actions';

type Batch = { name: string; ageGroup: string; days: string; startTime: string; endTime: string; venue: string | null; monthlyFee: number; active: boolean; branchId: string; coachId: string | null };
type Opt = { id: string; name: string };

function BatchFields({ branches, coaches, batch }: { branches: Opt[]; coaches: Opt[]; batch?: Batch }) {
  const days = batch?.days.split(',') ?? [];
  return (
    <>
      <div className="form-row">
        <label>Batch name *<input name="name" required maxLength={60} defaultValue={batch?.name} placeholder="e.g. Elite Juniors" /></label>
        <label>Age group *
          <select name="ageGroup" required defaultValue={batch?.ageGroup ?? ''}>
            <option value="" disabled>Select</option>
            {AGE_GROUPS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>Branch *
          <select name="branchId" required defaultValue={batch?.branchId ?? branches[0]?.id ?? ''}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>Coach
          <select name="coachId" defaultValue={batch?.coachId ?? ''}>
            <option value="">No coach yet</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="day-picker">
        <legend>Training days *</legend>
        {DAYS.map((d) => (
          <label key={d}><input type="checkbox" name="days" value={d} defaultChecked={days.includes(d)} /><span>{d}</span></label>
        ))}
      </fieldset>
      <div className="form-row">
        <label>Start time *<input name="startTime" type="time" required defaultValue={batch?.startTime ?? '16:00'} /></label>
        <label>End time *<input name="endTime" type="time" required defaultValue={batch?.endTime ?? '17:30'} /></label>
      </div>
      <div className="form-row">
        <label>Venue / net<input name="venue" maxLength={60} defaultValue={batch?.venue ?? ''} placeholder="e.g. Net 01" /></label>
        <label>Monthly fee (₹)<input name="monthlyFee" type="number" min={0} step={1} defaultValue={batch?.monthlyFee ?? ''} /></label>
      </div>
      <label>Status
        <select name="active" defaultValue={batch?.active === false ? 'false' : 'true'}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>
    </>
  );
}

export default async function BatchesPage() {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const [batches, branches, coaches] = await Promise.all([
    db.batch.findMany({
      orderBy: [{ active: 'desc' }, { startTime: 'asc' }],
      include: { branch: { select: { name: true } }, coach: { select: { name: true } }, _count: { select: { students: { where: { status: { not: 'INACTIVE' } } } } } },
    }),
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.coach.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const today = weekdayShort(todayISO());

  const addButton = isAdmin && branches.length > 0 && (
    <FormModal title="Create batch" eyebrow="BATCHES & SESSIONS" trigger={<><Plus size={17} /> New batch</>} action={createBatch} submitLabel="Create batch">
      <BatchFields branches={branches} coaches={coaches} />
    </FormModal>
  );

  return (
    <>
      <PageHeader title="Batches & Sessions" subtitle="Training groups, their weekly schedule and fees." actions={addButton} />
      {batches.length === 0 ? (
        <article className="panel padded">
          <Empty title="No batches yet" action={addButton}>
            {branches.length === 0 ? 'Create a branch first.' : isAdmin ? 'Create a batch with its training days, timing and monthly fee.' : 'An administrator can create batches.'}
          </Empty>
        </article>
      ) : (
        <div className="card-grid">
          {batches.map((b) => (
            <article key={b.id} className={`panel padded batch-card ${b.active ? '' : 'inactive'}`}>
              <div className="panel-head">
                <div>
                  <h3>{b.name} <span className="age-tag">{b.ageGroup}</span></h3>
                  <p>{b.branch.name}{b.active ? '' : ' · Inactive'}</p>
                </div>
                {isAdmin && (
                  <div className="row-actions">
                    <FormModal title={`Edit ${b.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={updateBatch.bind(null, b.id)}>
                      <BatchFields branches={branches} coaches={coaches} batch={b} />
                    </FormModal>
                    <ConfirmAction action={deleteBatch.bind(null, b.id)} confirmText={`Delete batch ${b.name}? Its ${b._count.students} students will be left without a batch.`} label="Delete"><Trash2 size={15} /></ConfirmAction>
                  </div>
                )}
              </div>
              <div className="day-row">
                {DAYS.map((d) => <span key={d} className={`${b.days.split(',').includes(d) ? 'on' : ''} ${d === today ? 'today' : ''}`}>{d.slice(0, 2)}</span>)}
              </div>
              <ul className="meta-list">
                <li><Clock3 size={14} /> {formatTime(b.startTime)} – {formatTime(b.endTime)}</li>
                <li><MapPin size={14} /> {b.venue ?? 'Venue not set'}</li>
                <li><UserRound size={14} /> {b.coach ? `Coach ${b.coach.name}` : 'No coach assigned'}</li>
              </ul>
              <div className="batch-foot">
                <Link href={`/students?batch=${b.id}`} className="text-btn">{b._count.students} students</Link>
                <b>{b.monthlyFee ? `${inr(b.monthlyFee)}/mo` : 'No fee set'}</b>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
