// Parent app: the child's facility bookings, and the way in to the booking site.
import '@/app/rentals.css';
import Link from 'next/link';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { HOLDING } from '@/lib/rentals/constants';
import { bookingWhen } from '@/lib/rentals/notify';
import { StatusChip } from './ui';

export async function FamilyBookings({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [bookings, open] = await Promise.all([
    db.rentalBooking.findMany({
      where: { studentId, status: { in: HOLDING } },
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      take: 5,
      select: { id: true, code: true, kind: true, status: true, date: true, startMin: true, endMin: true, returnDate: true, facility: { select: { name: true } } },
    }),
    db.rentalFacility.count({ where: { status: 'ACTIVE' } }),
  ]);
  if (bookings.length === 0 && open === 0) return null; // online booking is not in use yet
  return (
    <section className="panel padded" style={{ marginBottom: 14 }}>
      <div className="panel-head">
        <div>
          <h3><CalendarCheck size={16} /> Facility bookings</h3>
          <p>Nets, turf, bowling machine and equipment booked for {studentName}, at the student price.</p>
        </div>
        <div className="rn-actions">
          <Link className="text-btn" href="/book/account">All bookings</Link>
          {open > 0 && <Link className="secondary-btn" href="/book">Book a facility <ArrowRight size={14} /></Link>}
        </div>
      </div>
      {bookings.length === 0 ? <p className="muted small-note">No upcoming bookings.</p> : (
        <ul className="rn-unit-list">
          {bookings.map((b) => (
            <li key={b.id}>
              <div className="stack">
                <b><Link href={`/book/account/${b.id}`}>{b.facility.name}</Link></b>
                <small className="muted">{bookingWhen(b)} · {b.code}</small>
              </div>
              <StatusChip status={b.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
