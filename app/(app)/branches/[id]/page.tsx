import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Pencil, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth';
import { FACILITIES, MAX_BRANCH_PHOTOS, parseFacilities } from '@/lib/facilities';
import { directionsUrl } from '@/lib/maps';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { GalleryUploader } from '@/components/GalleryUploader';
import { FacilityChips, PhotoGrid } from '@/components/Facilities';
import { Empty, Panel } from '@/components/ui';
import { deleteBranchPhoto, saveFacilities, uploadBranchPhoto } from '../facility-actions';

export default async function BranchPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminPage();
  const branch = await db.branch.findUnique({
    where: { id: params.id },
    include: { photos: { orderBy: { createdAt: 'asc' }, select: { id: true, caption: true } } },
  });
  if (!branch) notFound();
  const current = parseFacilities(branch.facilities);
  const has = (key: string) => current.find((f) => f.key === key);
  const custom = current.filter((f) => f.key === 'CUSTOM').map((f) => f.label).join('\n');
  const maps = directionsUrl(branch);

  return (
    <>
      <Link href="/branches" className="back-link"><ArrowLeft size={14} /> All branches</Link>
      <div className="match-head panel padded">
        <div>
          <span className="eyebrow">BRANCH</span>
          <h1>{branch.name}</h1>
          <p className="muted">{branch.address ?? 'No address added'}</p>
          {maps && <a className="text-btn map-link" href={maps} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> Open in Google Maps</a>}
        </div>
      </div>

      <div className="two-col">
        <Panel
          title="Facilities"
          subtitle="Shown to parents of students at this branch"
          action={
            <FormModal title={`Facilities at ${branch.name}`} eyebrow="FACILITIES" trigger={<><Pencil size={14} /> Edit</>} triggerClassName="text-btn" action={saveFacilities.bind(null, branch.id)} submitLabel="Save facilities">
              <ul className="facility-form">
                {FACILITIES.map((f) => (
                  <li key={f.key}>
                    <label className="inline-check"><input type="checkbox" name={`f_${f.key}`} defaultChecked={!!has(f.key)} /> <span aria-hidden>{f.emoji}</span> {f.label}</label>
                    <input name={`d_${f.key}`} maxLength={80} defaultValue={has(f.key)?.detail ?? ''} placeholder={f.hint || 'details (optional)'} aria-label={`${f.label} details`} />
                  </li>
                ))}
              </ul>
              <label>Other facilities <small className="muted">(one per line)</small>
                <textarea name="custom" rows={3} maxLength={1000} defaultValue={custom} placeholder={'e.g. AC hall\nCertified coaches'} />
              </label>
            </FormModal>
          }
        >
          <FacilityChips json={branch.facilities} empty={<Empty title="No facilities added yet">Click Edit to tick what this branch offers, e.g. indoor nets, bowling machine, special mentoring.</Empty>} />
        </Panel>

        <Panel
          title="Photos"
          subtitle={`${branch.photos.length} of ${MAX_BRANCH_PHOTOS} · parents see these in the parent app`}
          action={<GalleryUploader upload={uploadBranchPhoto.bind(null, branch.id)} remaining={MAX_BRANCH_PHOTOS - branch.photos.length} />}
        >
          {branch.photos.length === 0 ? (
            <Empty title="No photos yet">Add photos of the nets, pitch and facilities. Big phone photos are resized automatically.</Empty>
          ) : (
            <PhotoGrid
              photos={branch.photos}
              action={(id) => (
                <ConfirmAction action={deleteBranchPhoto.bind(null, id)} confirmText="Delete this photo?" label="Delete photo"><Trash2 size={14} /></ConfirmAction>
              )}
            />
          )}
        </Panel>
      </div>
    </>
  );
}
