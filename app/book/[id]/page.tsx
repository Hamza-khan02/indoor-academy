import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { addDays, todayISO } from '@/lib/dates';
import { getBooker } from '@/lib/rentals/account';
import { CATEGORIES } from '@/lib/rentals/constants';
import { gatewayConfig, getRentalSettings } from '@/lib/rentals/settings';
import { BookingForm } from '@/components/rentals/BookingForm';
import { customerCreateBooking, customerQuote, publicSlots } from '../actions';

/** The booking form for one facility. Looking is public; confirming needs a login. */
export default async function BookFacilityPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ package?: string; slots?: string; date?: string }> }) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const [facility, booker, settings, items] = await Promise.all([
    db.rentalFacility.findUnique({
      where: { id },
      include: { pricing: true, packages: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    }),
    getBooker(),
    getRentalSettings(),
    db.equipmentItem.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }], select: { id: true, name: true, rentalPrice: true, priceUnit: true } }),
  ]);
  if (!facility || facility.status === 'INACTIVE') notFound();
  const today = todayISO();
  const cat = CATEGORIES[facility.category];

  return (
    <>
      <Link href="/book" className="back-link"><ArrowLeft size={14} /> All facilities</Link>
      <div className="bk-title">
        <div>
          <span className="eyebrow">{cat?.emoji} {cat?.label.toUpperCase()}</span>
          <h1>{facility.name}</h1>
          {facility.description && <p>{facility.description}</p>}
        </div>
      </div>
      {facility.status !== 'ACTIVE' ? (
        <p className="rn-note warn">{facility.name} is under maintenance and cannot be booked right now{facility.maintenanceNote ? `: ${facility.maintenanceNote}` : '.'}</p>
      ) : (
        <BookingForm
          mode="customer"
          facility={{
            id: facility.id, name: facility.name, category: facility.category, slotMinutes: facility.slotMinutes, maxSlots: facility.maxSlots, capacity: facility.capacity,
            wholeDay: facility.pricing?.unit === 'PER_DAY', equipmentOnly: facility.category === 'EQUIPMENT',
            packages: facility.packages.map((p) => ({ id: p.id, name: p.name, description: p.description, includesNet: p.includesNet, includesOperator: p.includesOperator, includesBalls: p.includesBalls })),
            resources: [],
          }}
          items={items}
          today={today}
          lastDay={addDays(today, settings.bookingWindowDays)}
          booker={!booker ? null : booker.kind === 'CUSTOMER' ? { kind: 'CUSTOMER' } : { kind: 'FAMILY', students: booker.students.map((s) => ({ id: s.id, name: s.name, active: s.status !== 'INACTIVE' })) }}
          onlineAvailable={Boolean(gatewayConfig())}
          payAtVenue={settings.allowPayAtVenue}
          initial={{ date: sp.date, packageId: facility.packages.some((p) => p.id === sp.package) ? sp.package : undefined, slots: sp.slots && /^\d+$/.test(sp.slots) ? Number(sp.slots) : undefined }}
          loginHref={`/book/login?next=${encodeURIComponent(`/book/${facility.id}`)}`}
          successBase="/book/account/"
          loadSlots={publicSlots}
          getQuote={customerQuote}
          submit={customerCreateBooking}
        />
      )}
    </>
  );
}
