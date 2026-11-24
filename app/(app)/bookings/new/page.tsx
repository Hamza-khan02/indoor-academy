import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { todayISO } from '@/lib/dates';
import { CATEGORIES } from '@/lib/rentals/constants';
import { requireRental } from '@/lib/rentals/staff';
import { Empty, PageHeader } from '@/components/ui';
import { BookingForm } from '@/components/rentals/BookingForm';
import { FacilityChip, priceText } from '@/components/rentals/ui';
import { staffCreateBooking, staffQuote, staffSlots } from '../actions';

/** Manual booking by staff: walk-ins, phone bookings and bookings for students. */
export default async function NewBookingPage(props: { searchParams: Promise<{ facility?: string; date?: string; start?: string; unit?: string }> }) {
  const sp = await props.searchParams;
  await requireRental('create');
  const today = todayISO();
  const facilities = await db.rentalFacility.findMany({
    where: { status: { not: 'INACTIVE' } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { pricing: true, packages: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }, resources: { where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true } } },
  });
  const facility = facilities.find((f) => f.id === sp.facility);

  if (!facility) {
    return (
      <>
        <PageHeader title="New booking" subtitle="Choose what the customer wants to book." />
        {facilities.length === 0 ? (
          <article className="panel padded"><Empty title="Nothing can be booked yet">An administrator needs to add facilities and open them for booking.</Empty></article>
        ) : (
          <div className="card-grid">
            {facilities.map((f) => (
              <Link key={f.id} href={`/bookings/new?facility=${f.id}`} className="panel padded rn-facility">
                <div className="panel-head">
                  <div><h3>{CATEGORIES[f.category]?.emoji} {f.name}</h3><p>{CATEGORIES[f.category]?.label} · {priceText(f.pricing)}</p></div>
                  <FacilityChip status={f.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </>
    );
  }

  const [items, students] = await Promise.all([
    db.equipmentItem.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }], select: { id: true, name: true, rentalPrice: true, priceUnit: true } }),
    db.student.findMany({ where: { status: { not: 'INACTIVE' } }, orderBy: { name: 'asc' }, select: { id: true, name: true, guardianPhone: true } }),
  ]);
  const start = sp.start && /^\d+$/.test(sp.start) ? Number(sp.start) : undefined;

  return (
    <>
      <Link href="/bookings/new" className="back-link"><ArrowLeft size={14} /> Choose another facility</Link>
      <PageHeader title={`Book ${facility.name}`} subtitle="A booking entered here is confirmed straight away. Record any money received on the right." />
      {facility.status !== 'ACTIVE' && <p className="rn-note warn spaced-bottom">{facility.name} is under maintenance, so it cannot be booked until it is opened again.</p>}
      <BookingForm
        mode="staff"
        facility={{
          id: facility.id, name: facility.name, category: facility.category, slotMinutes: facility.slotMinutes, maxSlots: facility.maxSlots, capacity: facility.capacity,
          wholeDay: facility.pricing?.unit === 'PER_DAY', equipmentOnly: facility.category === 'EQUIPMENT',
          packages: facility.packages.map((p) => ({ id: p.id, name: p.name, description: p.description, includesNet: p.includesNet, includesOperator: p.includesOperator, includesBalls: p.includesBalls })),
          resources: facility.resources,
        }}
        items={items}
        today={today}
        lastDay="2999-12-31"
        booker={null}
        students={students.map((s) => ({ id: s.id, name: s.name, phone: s.guardianPhone }))}
        onlineAvailable={false}
        payAtVenue
        initial={{ date: sp.date, startMin: start, resourceId: sp.unit }}
        loginHref="/login"
        successBase="/bookings/"
        loadSlots={staffSlots}
        getQuote={staffQuote}
        submit={staffCreateBooking}
      />
    </>
  );
}
