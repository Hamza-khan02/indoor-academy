import Link from 'next/link';
import { ArrowRight, Clock, MapPin, Plus, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/rentals/constants';
import { requireRental } from '@/lib/rentals/staff';
import { durationLabel, rangeLabel } from '@/lib/rentals/time';
import { FormModal } from '@/components/FormModal';
import { Empty, PageHeader } from '@/components/ui';
import { FacilityFields } from '@/components/rentals/fields';
import { FacilityChip, priceText } from '@/components/rentals/ui';
import { createFacility } from '../actions';

export default async function FacilitiesPage() {
  await requireRental('config');
  const [facilities, branches] = await Promise.all([
    db.rentalFacility.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { pricing: true, resources: { select: { status: true } }, branch: { select: { name: true } }, _count: { select: { bookings: true } } },
    }),
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const addButton = (
    <FormModal title="Add facility" eyebrow="FACILITIES" trigger={<><Plus size={17} /> Add facility</>} action={createFacility} submitLabel="Add facility">
      <FacilityFields branches={branches} />
    </FormModal>
  );

  return (
    <>
      <PageHeader title="Facilities" subtitle="Nets, turf, practice pitches, bowling machines and the equipment counter that customers can book." actions={addButton} />
      {facilities.length === 0 ? (
        <article className="panel padded">
          <Empty title="No facilities yet" action={addButton}>Add what the academy rents out. Each facility gets its own units, timings, prices and calendar.</Empty>
        </article>
      ) : CATEGORY_KEYS.map((category) => {
        const list = facilities.filter((f) => f.category === category);
        if (list.length === 0) return null;
        return (
          <section key={category}>
            <h2 className="rn-cat">{CATEGORIES[category].emoji} {CATEGORIES[category].label} <span>{list.length}</span></h2>
            <div className="card-grid">
              {list.map((f) => {
                const open = f.resources.filter((r) => r.status === 'ACTIVE').length;
                return (
                  <article key={f.id} className={`panel padded rn-facility${f.status === 'ACTIVE' ? '' : ' off'}`}>
                    <div className="panel-head">
                      <div>
                        <h3><Link href={`/bookings/facilities/${f.id}`}>{f.name}</Link></h3>
                        <p>{priceText(f.pricing)} · {f._count.bookings} booking{f._count.bookings === 1 ? '' : 's'} so far</p>
                      </div>
                      <FacilityChip status={f.status} />
                    </div>
                    <ul className="meta-list">
                      <li><Clock size={14} /> {rangeLabel(f.openTime, f.closeTime)}{category !== 'EQUIPMENT' && ` · ${durationLabel(f.slotMinutes)} slots`}</li>
                      {category !== 'EQUIPMENT' && <li><Users size={14} /> {open} of {f.resources.length} unit{f.resources.length === 1 ? '' : 's'} available · up to {f.capacity} people</li>}
                      <li><MapPin size={14} /> {f.branch?.name ?? 'All branches'}</li>
                    </ul>
                    <Link className="text-btn" href={`/bookings/facilities/${f.id}`}>Manage units, timings and blocked dates <ArrowRight size={13} /></Link>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
