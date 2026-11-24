import Link from 'next/link';
import { ArrowRight, Bell, FileText, Plus, UserRound } from 'lucide-react';
import { db } from '@/lib/db';
import { inr } from '@/lib/format';
import { ownBookings, ownNotifications, requireBooker } from '@/lib/rentals/account';
import { PAYMENT_METHODS } from '@/lib/rentals/constants';
import { amountDue } from '@/lib/rentals/core';
import { rangeLabel } from '@/lib/rentals/time';
import { StatusChip } from '@/components/rentals/ui';
import { markNotificationsRead } from '../actions';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const stamp = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const CURRENT = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];

type Row = { id: string; code: string; kind: string; status: string; date: string; startMin: number; endMin: number; customerName: string; total: number; deposit: number; paid: number; facility: { name: string }; package: { name: string } | null };

function BookingRow({ b, family }: { b: Row; family: boolean }) {
  const due = amountDue(b);
  return (
    <Link className="bk-booking" href={`/book/account/${b.id}`}>
      <div className="bk-booking-date"><small>{MONTHS[Number(b.date.slice(5, 7)) - 1]}</small><b>{Number(b.date.slice(8))}</b></div>
      <div className="stack">
        <b>{b.facility.name}{b.package ? ` · ${b.package.name}` : ''}</b>
        <small className="muted">{b.kind === 'EQUIPMENT' ? 'Equipment rental' : rangeLabel(b.startMin, b.endMin)} · {b.code}{family ? ` · ${b.customerName}` : ''}</small>
        {CURRENT.includes(b.status) && due > 0 && <small className="c-late">{inr(due)} to pay</small>}
      </div>
      <StatusChip status={b.status} />
    </Link>
  );
}

/** The customer's dashboard: upcoming bookings, history, payments, messages. */
export default async function AccountPage() {
  const booker = await requireBooker('/book/account');
  const [bookings, payments, notes] = await Promise.all([
    db.rentalBooking.findMany({
      where: ownBookings(booker),
      orderBy: [{ date: 'desc' }, { startMin: 'desc' }],
      take: 100,
      select: { id: true, code: true, kind: true, status: true, date: true, startMin: true, endMin: true, customerName: true, total: true, deposit: true, paid: true, facility: { select: { name: true } }, package: { select: { name: true } } },
    }),
    db.rentalPayment.findMany({ where: { status: 'PAID', booking: ownBookings(booker) }, orderBy: { paidAt: 'desc' }, take: 30, include: { booking: { select: { id: true, code: true } } } }),
    db.rentalNotification.findMany({ where: ownNotifications(booker), orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);
  const family = booker.kind === 'FAMILY';
  const upcoming = bookings.filter((b) => CURRENT.includes(b.status)).reverse();
  const history = bookings.filter((b) => !CURRENT.includes(b.status));
  const unread = notes.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="bk-title">
        <div>
          <span className="eyebrow">{family ? 'ACADEMY FAMILY' : 'BOOKING ACCOUNT'}</span>
          <h1>{family ? 'Your family’s bookings' : `Hello, ${booker.label}`}</h1>
          <p>{family ? `Bookings for ${booker.students.map((s) => s.name).join(', ') || 'your children'}, at student prices.` : 'Your bookings, payments and receipts.'}</p>
        </div>
        <div className="rn-actions">
          {!family && <Link className="secondary-btn" href="/book/account/profile"><UserRound size={15} /> Profile</Link>}
          <Link className="primary-btn" href="/book"><Plus size={16} /> New booking</Link>
        </div>
      </div>

      <div className="rn-two">
        <div className="rn-stack">
          <section className="bk-card">
            <div className="panel-head"><div><h3>Upcoming bookings</h3><p>Open a booking to pay, reschedule or cancel it.</p></div></div>
            {upcoming.length === 0
              ? <div className="rn-empty"><b>No upcoming bookings</b>Pick a facility and a free slot to make one.<br /><Link className="text-btn" href="/book" style={{ marginTop: 10 }}>See what you can book <ArrowRight size={13} /></Link></div>
              : upcoming.map((b) => <BookingRow key={b.id} b={b} family={family} />)}
          </section>
          <section className="bk-card">
            <div className="panel-head"><div><h3>Booking history</h3><p>Completed, cancelled and expired bookings. Open one to book it again.</p></div></div>
            {history.length === 0 ? <div className="rn-empty">Nothing here yet.</div> : history.map((b) => <BookingRow key={b.id} b={b} family={family} />)}
          </section>
        </div>

        <div className="rn-stack">
          <section className="bk-card">
            <div className="panel-head">
              <div><h3><Bell size={16} /> Messages {unread > 0 && <span className="new-tag">{unread} new</span>}</h3></div>
              {unread > 0 && <form action={markNotificationsRead}><button className="text-btn">Mark as read</button></form>}
            </div>
            {notes.length === 0 ? <div className="rn-empty">Booking confirmations and reminders appear here.</div> : notes.map((n) => (
              <div key={n.id} className="bk-note-item">
                <b>{n.title}{!n.readAt && <span className="new-tag">New</span>}</b>
                <p>{n.body.split('\n\n')[0]}</p>
                <small>{stamp(n.createdAt)}{n.bookingId && <> · <Link className="text-btn inline" href={`/book/account/${n.bookingId}`}>open booking</Link></>}</small>
              </div>
            ))}
          </section>
          <section className="bk-card">
            <div className="panel-head"><div><h3>Payment history</h3><p>Every payment has a receipt.</p></div></div>
            {payments.length === 0 ? <div className="rn-empty">No payments yet.</div> : (
              <ul className="rn-unit-list">
                {payments.map((p) => (
                  <li key={p.id}>
                    <div className="stack">
                      <b>{inr(p.amount)} · {PAYMENT_METHODS[p.method] ?? p.method}</b>
                      <small className="muted">{p.paidAt ? stamp(p.paidAt) : ''} · {p.booking.code}{p.receiptNo ? ` · ${p.receiptNo}` : ''}</small>
                    </div>
                    <Link className="icon-action" href={`/rental-receipt/${p.booking.id}`} target="_blank" title="Receipt" aria-label={`Receipt for ${p.booking.code}`}><FileText size={15} /></Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
