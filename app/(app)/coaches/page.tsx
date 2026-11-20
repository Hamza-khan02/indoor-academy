import { Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { COACH_SPECIALIZATIONS } from '@/lib/constants';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Avatar, Empty, PageHeader, StatusPill } from '@/components/ui';
import { createCoach, deleteCoach, updateCoach } from './actions';

type Coach = { name: string; phone: string | null; email: string | null; specialization: string | null; active: boolean; branchId: string | null };

function CoachFields({ branches, coach }: { branches: { id: string; name: string }[]; coach?: Coach }) {
  return (
    <>
      <label>Name *<input name="name" required maxLength={80} defaultValue={coach?.name} /></label>
      <div className="form-row">
        <label>Phone<input name="phone" type="tel" defaultValue={coach?.phone ?? ''} /></label>
        <label>Email<input name="email" type="email" defaultValue={coach?.email ?? ''} /></label>
      </div>
      <div className="form-row">
        <label>Specialization
          <select name="specialization" defaultValue={coach?.specialization ?? ''}>
            <option value="">Not set</option>
            {COACH_SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Branch
          <select name="branchId" defaultValue={coach?.branchId ?? ''}>
            <option value="">Any / all branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </div>
      <label>Status
        <select name="active" defaultValue={coach?.active === false ? 'false' : 'true'}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>
    </>
  );
}

export default async function CoachesPage() {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const [coaches, branches] = await Promise.all([
    db.coach.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { branch: { select: { name: true } }, batches: { where: { active: true }, select: { name: true, _count: { select: { students: true } } } } },
    }),
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const addButton = isAdmin && (
    <FormModal title="Add coach" eyebrow="COACHING STAFF" trigger={<><Plus size={17} /> Add coach</>} action={createCoach} submitLabel="Add coach">
      <CoachFields branches={branches} />
    </FormModal>
  );

  return (
    <>
      <PageHeader title="Coaches" subtitle="Coaching staff and the batches they run." actions={addButton} />
      <article className="panel padded">
        {coaches.length === 0 ? (
          <Empty title="No coaches yet" action={addButton}>{isAdmin ? 'Add your coaches, then assign them to batches.' : 'An administrator can add coaches.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>COACH</th><th>SPECIALIZATION</th><th>BRANCH</th><th>CONTACT</th><th>BATCHES</th><th>STATUS</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {coaches.map((c) => (
                  <tr key={c.id}>
                    <td><div className="player-cell"><Avatar name={c.name} /><b>{c.name}</b></div></td>
                    <td>{c.specialization ?? '—'}</td>
                    <td>{c.branch?.name ?? 'All branches'}</td>
                    <td><div className="stack"><span>{c.phone ?? '—'}</span><small className="muted">{c.email ?? ''}</small></div></td>
                    <td className="wrap">
                      {c.batches.length === 0 ? <small className="muted">None</small> : c.batches.map((b) => (
                        <span key={b.name} className="batch-tag spaced">{b.name} · {b._count.students}</span>
                      ))}
                    </td>
                    <td><StatusPill status={c.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                    {isAdmin && (
                      <td>
                        <div className="row-actions">
                          <FormModal title={`Edit ${c.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={updateCoach.bind(null, c.id)}>
                            <CoachFields branches={branches} coach={c} />
                          </FormModal>
                          <ConfirmAction action={deleteCoach.bind(null, c.id)} confirmText={`Delete coach ${c.name}? Their batches will be left without a coach.`} label="Delete"><Trash2 size={15} /></ConfirmAction>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}
