import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { COACH_SPECIALIZATIONS } from '@/lib/constants';
import { todayISO } from '@/lib/dates';
import { coachPhotoUrl } from '@/lib/photos';
import { removeCoachPhoto, uploadCoachPhoto } from '@/lib/photo-actions';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { PhotoEditor } from '@/components/PhotoEditor';
import { Avatar, Empty, PageHeader, StatusPill } from '@/components/ui';
import { createCoach, deleteCoach, updateCoach, updateCoachProfile } from './actions';

type Coach = { name: string; phone: string | null; email: string | null; specialization: string | null; active: boolean; branchId: string | null };
type CoachProfile = {
  id: string; name: string; bio: string | null; coachingSince: number | null; experience: string | null; achievements: string | null;
  instagramUrl: string | null; facebookUrl: string | null; youtubeUrl: string | null; photoUpdatedAt: Date | null;
};

/** What visitors see on the coach's page of the public home page. */
function ProfileFields({ coach }: { coach: CoachProfile }) {
  return (
    <>
      <div className="coach-photo-row">
        <PhotoEditor name={coach.name} photo={coachPhotoUrl(coach)} upload={uploadCoachPhoto.bind(null, coach.id)} remove={removeCoachPhoto.bind(null, coach.id)} />
        <p className="form-hint">The photo is saved as soon as you choose it. A clear, close photo of the coach works best.</p>
      </div>
      <label>About the coach<textarea name="bio" rows={4} maxLength={1500} defaultValue={coach.bio ?? ''} placeholder="A few lines about the coach: playing career, coaching style, what they are known for." /></label>
      <label>Coaching since (year)<input name="coachingSince" type="number" min={1950} max={Number(todayISO().slice(0, 4))} defaultValue={coach.coachingSince ?? ''} placeholder="e.g. 2012" /></label>
      <label>Experience and qualifications <small className="muted">(one per line)</small>
        <textarea name="experience" rows={4} maxLength={2000} defaultValue={coach.experience ?? ''} placeholder={'Played district-level cricket for 8 years\nCertified Level 1 coach'} />
      </label>
      <label>Trophies and awards <small className="muted">(one per line; start with the year if you like)</small>
        <textarea name="achievements" rows={5} maxLength={3000} defaultValue={coach.achievements ?? ''} placeholder={'2019 - District championship winners\n2021 - Best coach award'} />
      </label>
      <label>Instagram<input name="instagramUrl" maxLength={200} defaultValue={coach.instagramUrl ?? ''} placeholder="@handle or instagram.com/handle" /></label>
      <div className="form-row">
        <label>Facebook<input name="facebookUrl" maxLength={200} defaultValue={coach.facebookUrl ?? ''} placeholder="facebook.com/page" /></label>
        <label>YouTube<input name="youtubeUrl" maxLength={200} defaultValue={coach.youtubeUrl ?? ''} placeholder="youtube.com/@channel" /></label>
      </div>
      <p className="form-hint">Everything here is public. The coach&apos;s phone and email are never shown on the home page.</p>
    </>
  );
}

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
      <PageHeader title="Coaches" subtitle="Coaching staff and the batches they run. Active coaches have a public profile page on the home page." actions={addButton} />
      <article className="panel padded">
        {coaches.length === 0 ? (
          <Empty title="No coaches yet" action={addButton}>{isAdmin ? 'Add your coaches, then assign them to batches.' : 'An administrator can add coaches.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>COACH</th><th>SPECIALIZATION</th><th>BRANCH</th><th>CONTACT</th><th>BATCHES</th><th>PUBLIC PROFILE</th><th>STATUS</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {coaches.map((c) => (
                  <tr key={c.id}>
                    <td><div className="player-cell"><Avatar name={c.name} photo={coachPhotoUrl(c)} /><b>{c.name}</b></div></td>
                    <td>{c.specialization ?? '—'}</td>
                    <td>{c.branch?.name ?? 'All branches'}</td>
                    <td><div className="stack"><span>{c.phone ?? '—'}</span><small className="muted">{c.email ?? ''}</small></div></td>
                    <td className="wrap">
                      {c.batches.length === 0 ? <small className="muted">None</small> : c.batches.map((b) => (
                        <span key={b.name} className="batch-tag spaced">{b.name} · {b._count.students}</span>
                      ))}
                    </td>
                    <td>
                      <div className="row-actions">
                        {isAdmin && (
                          <FormModal
                            title={`${c.name}'s public profile`}
                            eyebrow="HOME PAGE"
                            description="Shown on the coach's page of the home page. Leave anything empty to hide it."
                            trigger={<><Pencil size={13} /> Edit profile</>}
                            triggerClassName="text-btn"
                            action={updateCoachProfile.bind(null, c.id)}
                            submitLabel="Save profile"
                          >
                            <ProfileFields coach={c} />
                          </FormModal>
                        )}
                        {c.active
                          ? <a className="icon-action" href={`/home/coach/${c.id}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${c.name}'s public page`} title="View public page"><ExternalLink size={15} /></a>
                          : <small className="muted">Hidden while inactive</small>}
                      </div>
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
