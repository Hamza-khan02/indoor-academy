import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { directionsUrl } from '@/lib/maps';
import { db } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth';
import { addDays, todayISO } from '@/lib/dates';
import { percent } from '@/lib/format';
import { attended } from '@/lib/queries';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { AttendanceBar, Empty, PageHeader } from '@/components/ui';
import { createBranch, deleteBranch, updateBranch } from './actions';

function BranchFields({ branch }: { branch?: { name: string; address: string | null; mapsUrl: string | null } }) {
  return (
    <>
      <label>Branch name *<input name="name" required maxLength={60} defaultValue={branch?.name} placeholder="e.g. Sultanpur City" /></label>
      <label>Address<textarea name="address" rows={2} maxLength={200} defaultValue={branch?.address ?? ''} placeholder="Road, landmark, city, PIN" /></label>
      <label>Google Maps link<input name="mapsUrl" type="url" maxLength={300} defaultValue={branch?.mapsUrl ?? ''} placeholder="https://maps.app.goo.gl/..." /></label>
      <p className="form-hint">In Google Maps, open the place → <b>Share</b> → <b>Copy link</b>, and paste it here. Parents get a Directions button. Without a link, the address is searched on Google Maps.</p>
    </>
  );
}

export default async function BranchesPage() {
  await requireAdminPage();
  const since = addDays(todayISO(), -29);
  const [branches, recent] = await Promise.all([
    db.branch.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { batches: true, coaches: true } }, students: { where: { status: { not: 'INACTIVE' } }, select: { id: true } } },
    }),
    db.attendance.findMany({ where: { date: { gte: since } }, select: { status: true, student: { select: { branchId: true } } } }),
  ]);
  const att = new Map<string, { a: number; t: number }>();
  for (const r of recent) {
    const cur = att.get(r.student.branchId) ?? { a: 0, t: 0 };
    cur.t++;
    if (attended(r.status)) cur.a++;
    att.set(r.student.branchId, cur);
  }

  const addButton = (
    <FormModal title="Add branch" eyebrow="LOCATIONS" trigger={<><Plus size={17} /> Add branch</>} action={createBranch} submitLabel="Create branch">
      <BranchFields />
    </FormModal>
  );

  return (
    <>
      <PageHeader title="Branches" subtitle="Academy locations. Attendance is for the last 30 days." actions={addButton} />
      {branches.length === 0 ? (
        <article className="panel padded"><Empty title="No branches yet" action={addButton}>Create at least one branch before adding students and batches.</Empty></article>
      ) : (
        <div className="card-grid">
          {branches.map((b) => {
            const a = att.get(b.id);
            return (
              <article key={b.id} className="panel padded">
                <div className="panel-head">
                  <div><h3>{b.name}</h3><p>{b.address ?? 'No address added'}</p>{directionsUrl(b) && <a className="text-btn map-link" href={directionsUrl(b)!} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> {b.mapsUrl ? 'Open in Google Maps' : 'Search address on Google Maps'}</a>}</div>
                  <div className="row-actions">
                    <FormModal title={`Edit ${b.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={updateBranch.bind(null, b.id)}>
                      <BranchFields branch={b} />
                    </FormModal>
                    <ConfirmAction action={deleteBranch.bind(null, b.id)} confirmText={`Delete branch ${b.name}?`} label="Delete"><Trash2 size={15} /></ConfirmAction>
                  </div>
                </div>
                <div className="mini-stats">
                  <div><strong>{b.students.length}</strong><small>Students</small></div>
                  <div><strong>{b._count.batches}</strong><small>Batches</small></div>
                  <div><strong>{b._count.coaches}</strong><small>Coaches</small></div>
                </div>
                <div className="branch-att"><small className="muted">Attendance</small><AttendanceBar pct={a ? percent(a.a, a.t) : null} /></div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
