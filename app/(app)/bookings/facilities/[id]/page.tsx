import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, Clock, IndianRupee, MapPin, Pencil, Plus, Power, Trash2, Users, Wrench } from 'lucide-react';
import { db } from '@/lib/db';
import { formatDate, todayISO } from '@/lib/dates';
import { CATEGORIES, HOLDING } from '@/lib/rentals/constants';
import { requireRental } from '@/lib/rentals/staff';
import { durationLabel, rangeLabel } from '@/lib/rentals/time';
import { ConfirmAction } from '@/components/ConfirmAction';
import { FormModal } from '@/components/FormModal';
import { Empty, Panel } from '@/components/ui';
import { BlockoutFields, FacilityFields, ResourceFields } from '@/components/rentals/fields';
import { Chip, FacilityChip, priceText } from '@/components/rentals/ui';
import { deleteBlockout, deleteFacility, deleteResource, saveBlockout, saveResource, setFacilityStatus, updateFacility } from '../../actions';

export default async function FacilityPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  await requireRental('config');
  const today = todayISO();
  const [facility, branches, upcoming] = await Promise.all([
    db.rentalFacility.findUnique({
      where: { id },
      include: {
        pricing: true, branch: { select: { name: true } },
        resources: { orderBy: { code: 'asc' }, include: { _count: { select: { bookings: true } } } },
        blockouts: { where: { toDate: { gte: today } }, orderBy: { fromDate: 'asc' }, include: { resource: { select: { name: true } } } },
      },
    }),
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.rentalBooking.count({ where: { status: { in: HOLDING }, date: { gte: today }, OR: [{ facilityId: id }, { resources: { some: { resource: { facilityId: id } } } }] } }),
  ]);
  if (!facility) notFound();
  const machine = facility.category === 'BOWLING_MACHINE';
  const equipmentOnly = facility.category === 'EQUIPMENT';
  const cat = CATEGORIES[facility.category];

  return (
    <>
      <Link href="/bookings/facilities" className="back-link"><ArrowLeft size={14} /> All facilities</Link>
      <div className="rn-head">
        <div>
          <span className="eyebrow">{cat?.emoji} {cat?.label.toUpperCase()}</span>
          <h1>{facility.name} <FacilityChip status={facility.status} /></h1>
          <ul className="rn-meta">
            <li><Clock size={14} /> {rangeLabel(facility.openTime, facility.closeTime)}{!equipmentOnly && ` · ${durationLabel(facility.slotMinutes)} slots, up to ${facility.maxSlots} per booking`}</li>
            {!equipmentOnly && <li><Users size={14} /> Up to {facility.capacity} people</li>}
            <li><MapPin size={14} /> {facility.branch?.name ?? 'All branches'}</li>
            <li><IndianRupee size={14} /> {priceText(facility.pricing)}</li>
          </ul>
          {facility.status !== 'ACTIVE' && facility.maintenanceNote && <p style={{ marginTop: 8 }}>Note: {facility.maintenanceNote}</p>}
          {facility.requiresApproval && <p style={{ marginTop: 8 }}>Customer bookings wait for staff approval.</p>}
        </div>
        <div className="rn-actions">
          <FormModal title="Open, maintenance or switch off" eyebrow="STATUS" trigger={<><Power size={15} /> Status</>} triggerClassName="secondary-btn" action={setFacilityStatus.bind(null, facility.id)} submitLabel="Save status">
            <label>Status *
              <select name="status" defaultValue={facility.status}>
                <option value="ACTIVE">Open for booking</option>
                <option value="MAINTENANCE">Under maintenance (cannot be booked)</option>
                <option value="INACTIVE">Switched off (hidden from customers)</option>
              </select>
            </label>
            <label>Note shown on the calendar<input name="maintenanceNote" maxLength={200} defaultValue={facility.maintenanceNote ?? ''} placeholder="e.g. Turf being relaid until Friday" /></label>
            <p className="form-hint">To close it only on some dates or hours, add a blocked time below instead.</p>
          </FormModal>
          <FormModal title={`Edit ${facility.name}`} eyebrow="FACILITY" trigger={<><Pencil size={15} /> Edit</>} triggerClassName="secondary-btn" action={updateFacility.bind(null, facility.id)}>
            <FacilityFields facility={facility} branches={branches} />
          </FormModal>
          <Link className="secondary-btn" href={`/bookings/pricing#f-${facility.id}`}><IndianRupee size={15} /> Prices</Link>
          <Link className="secondary-btn" href={`/bookings/calendar?facility=${facility.id}`}><CalendarDays size={15} /> Calendar</Link>
          <ConfirmAction action={deleteFacility.bind(null, facility.id)} confirmText={`Delete ${facility.name}? This only works if it has no bookings.`} className="secondary-btn danger" redirectTo="/bookings/facilities" label="Delete"><Trash2 size={15} /></ConfirmAction>
        </div>
      </div>
      {upcoming > 0 && facility.status !== 'ACTIVE' && <p className="rn-note warn spaced-bottom">{upcoming} upcoming booking(s) still use this facility. Reschedule or cancel them from Bookings.</p>}

      <div className="rn-two">
        {!equipmentOnly ? (
          <Panel
            title={machine ? 'Machines' : 'Units'}
            subtitle={`Each ${cat?.unit.toLowerCase()} is booked separately. Capacity of this facility = the number of available units.`}
            action={
              <FormModal title={machine ? 'Add machine' : 'Add unit'} eyebrow={facility.name.toUpperCase()} trigger={<><Plus size={14} /> Add</>} triggerClassName="text-btn" action={saveResource.bind(null, facility.id, null)} submitLabel="Add">
                <ResourceFields machine={machine} />
              </FormModal>
            }
          >
            {facility.resources.length === 0 ? <Empty title="No units yet">Add at least one so customers have something to book.</Empty> : (
              <ul className="rn-unit-list">
                {facility.resources.map((r) => (
                  <li key={r.id}>
                    <span className="rn-code">{r.code}</span>
                    <div className="stack">
                      <b>{r.name}</b>
                      <small className="muted">
                        {r._count.bookings} booking{r._count.bookings === 1 ? '' : 's'}
                        {machine && (r.speedMin || r.speedMax) ? ` · ${r.speedMin ?? '?'}–${r.speedMax ?? '?'} km/h` : ''}
                        {r.maintenanceNote && r.status !== 'ACTIVE' ? ` · ${r.maintenanceNote}` : ''}
                      </small>
                    </div>
                    <FacilityChip status={r.status} unit />
                    <div className="row-actions">
                      <FormModal title={`Edit ${r.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={saveResource.bind(null, facility.id, r.id)}>
                        <ResourceFields unit={r} machine={machine} />
                      </FormModal>
                      <ConfirmAction action={deleteResource.bind(null, r.id)} confirmText={`Delete ${r.name}? This only works if it has no bookings.`} label="Delete"><Trash2 size={15} /></ConfirmAction>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <Panel title="Equipment counter" subtitle="Customers rent items from the Equipment list for one or more days. This counter has no time slots.">
            <p className="rn-note">Its timings are the pick-up and return hours. The refundable deposit and cancellation rule are set under Pricing; the items and their prices under Equipment.</p>
            <div className="rn-actions" style={{ marginTop: 12 }}>
              <Link className="secondary-btn" href="/bookings/equipment">Equipment list</Link>
            </div>
          </Panel>
        )}

        <Panel
          title="Blocked dates and maintenance"
          subtitle="Times when it cannot be booked. A blocked time cannot be placed over existing bookings."
          action={
            <FormModal title="Block a time" eyebrow={facility.name.toUpperCase()} trigger={<><Wrench size={14} /> Block time</>} triggerClassName="text-btn" action={saveBlockout.bind(null, facility.id)} submitLabel="Block">
              <BlockoutFields units={facility.resources.map((r) => ({ id: r.id, name: r.name }))} today={today} />
            </FormModal>
          }
        >
          {facility.blockouts.length === 0 ? <Empty title="Nothing blocked">Open on every day during its timings.</Empty> : (
            <ul className="rn-unit-list">
              {facility.blockouts.map((b) => (
                <li key={b.id}>
                  <div className="stack">
                    <b>{formatDate(b.fromDate)}{b.toDate !== b.fromDate ? ` – ${formatDate(b.toDate)}` : ''}</b>
                    <small className="muted">
                      {b.startMin !== null && b.endMin !== null ? rangeLabel(b.startMin, b.endMin) : 'Whole day'} · {b.resource?.name ?? 'every unit'}{b.reason ? ` · ${b.reason}` : ''}
                    </small>
                  </div>
                  <Chip tone="grey">{b.kind === 'MAINTENANCE' ? 'Maintenance' : 'Blocked'}</Chip>
                  <ConfirmAction action={deleteBlockout.bind(null, b.id)} confirmText="Remove this blocked time? It can be booked again." label="Remove"><Trash2 size={15} /></ConfirmAction>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
