import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Ban, FileText, RotateCcw } from 'lucide-react';
import { db } from '@/lib/db';
import { addDays, formatDate, todayISO } from '@/lib/dates';
import { inr } from '@/lib/format';
import { ownBookings, requireBooker } from '@/lib/rentals/account';
import { PAYMENT_METHODS, REFUND_STATUS, UPCOMING } from '@/lib/rentals/constants';
import { advanceDue, amountDue } from '@/lib/rentals/core';
import { bookingWhen } from '@/lib/rentals/notify';
import { gatewayConfig, getRentalSettings } from '@/lib/rentals/settings';
import { durationLabel, hoursUntil } from '@/lib/rentals/time';
import { getSettings } from '@/lib/settings';
import { FormModal } from '@/components/FormModal';
import { PayOnline } from '@/components/rentals/PayOnline';
import { Reschedule } from '@/components/rentals/Reschedule';
import { Chip, LineChip, PriceLines, StatusChip, parseLines } from '@/components/rentals/ui';
import { cancelMyBooking, confirmPayment, myRescheduleSlots, rescheduleMyBooking, startPayment } from '../../actions';

const stamp = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function MyBookingPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const booker = await requireBooker(`/book/account/${id}`);
  const [b, settings, academy] = await Promise.all([
    // Only a booking that belongs to this login is ever loaded.
    db.rentalBooking.findFirst({
      where: { id, ...ownBookings(booker) },
      include: {
        facility: { include: { pricing: true } }, package: true,
        resources: { include: { resource: { select: { name: true } } } },
        equipment: { include: { item: { select: { name: true } } } },
        payments: { where: { status: 'PAID' }, orderBy: { paidAt: 'asc' } },
        refunds: { orderBy: { createdAt: 'asc' } },
      },
    }),
    getRentalSettings(),
    getSettings(),
  ]);
  if (!b) notFound();

  const today = todayISO();
  const due = amountDue(b);
  const live = ['PAYMENT_PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(b.status);
  const payNow = b.status === 'PAYMENT_PENDING' ? advanceDue(b, settings.advancePercent) : due;
  const online = Boolean(gatewayConfig());
  const upcoming = UPCOMING.includes(b.status);
  const hours = hoursUntil(b.date, b.startMin);
  const policy = b.facility.pricing;
  const charged = b.status === 'CONFIRMED' && policy && policy.cancelChargePct > 0 && hours < policy.cancelFreeHours;
  const canReschedule = upcoming && hours >= settings.rescheduleCutoffHours && b.rescheduleCount < settings.maxReschedules;
  const timed = b.kind === 'FACILITY' && policy?.unit !== 'PER_DAY';
  const slots = Math.max(1, Math.round((b.endMin - b.startMin) / b.facility.slotMinutes));
  const rebook = `/book/${b.facilityId}?${new URLSearchParams({ ...(b.packageId ? { package: b.packageId } : {}), slots: String(slots) })}`;
  const upi = settings.upiId ? `upi://pay?${new URLSearchParams({ pa: settings.upiId, pn: settings.upiName || academy.academyName, am: String(payNow), cu: 'INR', tn: `Booking ${b.code}` })}` : null;

  return (
    <>
      <Link href="/book/account" className="back-link"><ArrowLeft size={14} /> My bookings</Link>
      <div className="bk-title">
        <div>
          <span className="eyebrow">BOOKING ID {b.code}</span>
          <h1>{b.facility.name}{b.package ? ` · ${b.package.name}` : ''}</h1>
          <p>{bookingWhen(b)}{b.kind === 'FACILITY' ? ` · ${durationLabel(b.endMin - b.startMin)}` : ''}</p>
        </div>
        <StatusChip status={b.status} big />
      </div>

      {b.status === 'PENDING' && <p className="rn-note spaced-bottom">The academy will approve this request shortly. You will get a message here when it does.</p>}
      {b.status === 'PAYMENT_PENDING' && (
        <p className="rn-note warn spaced-bottom">
          Your slot is held{b.expiresAt ? ` until ${stamp(b.expiresAt)}` : ''}. Pay {inr(payNow)} to confirm it; after that the hold is released and someone else can book it.
        </p>
      )}
      {b.status === 'EXPIRED' && <p className="rn-note bad spaced-bottom">The hold ran out before payment, so the slot was released. You can book it again if it is still free.</p>}
      {b.cancelReason && ['REJECTED', 'CANCELLED', 'REFUNDED'].includes(b.status) && <p className="rn-note spaced-bottom">Reason: {b.cancelReason}</p>}

      <div className="rn-two">
        <div className="rn-stack">
          <section className="bk-card">
            <div className="panel-head"><div><h3>Booking details</h3></div></div>
            <dl className="rn-kv">
              <dt>For</dt><dd>{b.customerName}{b.customerType === 'STUDENT' ? ' (academy student)' : ''}</dd>
              <dt>Facility</dt><dd>{b.facility.name}{b.package ? ` · ${b.package.name}` : ''}</dd>
              {b.resources.length > 0 && <><dt>Where</dt><dd>{b.resources.map((r) => r.resource.name).join(' + ')}</dd></>}
              <dt>When</dt><dd>{bookingWhen(b)}</dd>
              {b.players && <><dt>Players</dt><dd>{b.players}</dd></>}
              {b.notes && <><dt>Your note</dt><dd>{b.notes}</dd></>}
              <dt>Booked on</dt><dd>{stamp(b.createdAt)}</dd>
            </dl>
            {b.equipment.length > 0 && (
              <ul className="rn-unit-list" style={{ marginTop: 14 }}>
                {b.equipment.map((e) => (
                  <li key={e.id}>
                    <div className="stack"><b>{e.item.name} × {e.qty}</b><small className="muted">{e.dueDate ? `Return by ${formatDate(e.dueDate)}` : ''}{e.charge > 0 ? ` · charge for damage or loss: ${inr(e.charge)}` : ''}</small></div>
                    <LineChip status={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bk-card">
            <div className="panel-head"><div><h3>Manage this booking</h3><p>{upcoming ? 'Changes are checked against what is free at that moment.' : 'This booking can no longer be changed.'}</p></div></div>
            <div className="rn-actions">
              <Link className="secondary-btn" href={`/rental-receipt/${b.id}`} target="_blank"><FileText size={15} /> {b.paid > 0 ? 'Download receipt' : 'Booking slip'}</Link>
              <Link className="secondary-btn" href={rebook}><RotateCcw size={15} /> Book this again</Link>
              {canReschedule && (
                <Reschedule bookingId={b.id} timed={timed} slotsNeeded={slots} today={today} lastDay={addDays(today, settings.bookingWindowDays)} currentDate={b.date}
                  loadSlots={myRescheduleSlots.bind(null, b.id)} action={rescheduleMyBooking} />
              )}
              {upcoming && hours > 0 && (
                <FormModal
                  title="Cancel this booking" eyebrow={`BOOKING ${b.code}`}
                  description={charged ? `It is less than ${policy!.cancelFreeHours} hours to the start, so ${policy!.cancelChargePct}% of the amount is kept as a cancellation charge (never more than you paid). The rest is refunded.` : b.paid > 0 ? 'Cancellation is free now. What you paid will be refunded by the academy.' : 'Cancellation is free.'}
                  trigger={<><Ban size={15} /> Cancel booking</>} triggerClassName="secondary-btn danger" action={cancelMyBooking.bind(null, b.id)} submitLabel="Cancel booking"
                >
                  <label>Reason (optional)<input name="reason" maxLength={300} /></label>
                </FormModal>
              )}
            </div>
            {upcoming && !canReschedule && <p className="rn-fineprint">{b.rescheduleCount >= settings.maxReschedules ? `This booking has been rescheduled ${b.rescheduleCount} times, the most allowed online.` : `Bookings can be rescheduled online until ${settings.rescheduleCutoffHours} hours before the start.`} Please call the academy to change it.</p>}
          </section>
        </div>

        <div className="rn-stack">
          <section className="bk-card">
            <div className="panel-head"><div><h3>Amount</h3></div></div>
            <PriceLines lines={parseLines(b.priceLines)} total={b.total} deposit={b.deposit} paid={b.paid} showPaid={live || b.paid > 0} />
            {live && due > 0 && (
              <div className="rn-actions" style={{ marginTop: 14 }}>
                {online && <PayOnline bookingId={b.id} amount={payNow} academy={academy.academyName} start={startPayment} confirm={confirmPayment} />}
                {settings.allowPayAtVenue && (
                  <p className="rn-note" style={{ width: '100%' }}>
                    {online ? 'Or pay' : 'Pay'} {inr(payNow)} at the academy counter (cash or UPI) and quote booking ID <b>{b.code}</b>.
                    {settings.upiId && <> UPI ID: <b>{settings.upiId}</b>.{upi && <> <a className="text-btn inline" href={upi}>Open my UPI app</a></>} Show the payment at the counter; staff will confirm it here.</>}
                  </p>
                )}
                {!online && !settings.allowPayAtVenue && <p className="rn-note warn" style={{ width: '100%' }}>Please call the academy to pay for this booking.</p>}
              </div>
            )}
            {b.cancelCharge > 0 && <p className="rn-note" style={{ marginTop: 10 }}>Cancellation charge: {inr(b.cancelCharge)}</p>}
          </section>

          {(b.payments.length > 0 || b.refunds.length > 0) && (
            <section className="bk-card">
              <div className="panel-head"><div><h3>Payments and refunds</h3></div></div>
              <ul className="rn-unit-list">
                {b.payments.map((p) => (
                  <li key={p.id}>
                    <div className="stack"><b>{inr(p.amount)} · {PAYMENT_METHODS[p.method] ?? p.method}</b><small className="muted">{p.paidAt ? stamp(p.paidAt) : ''}{p.receiptNo ? ` · Receipt ${p.receiptNo}` : ''}</small></div>
                    <Chip tone="green">Paid</Chip>
                  </li>
                ))}
                {b.refunds.map((r) => (
                  <li key={r.id}>
                    <div className="stack"><b>Refund {inr(r.amount)}</b><small className="muted">{r.reason ?? ''}{r.processedAt ? ` · ${stamp(r.processedAt)}` : ''}</small></div>
                    <Chip tone={r.status === 'PROCESSED' ? 'green' : r.status === 'REJECTED' ? 'grey' : 'amber'}>{REFUND_STATUS[r.status] ?? r.status}</Chip>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
