import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Ban, Check, CircleCheckBig, FileText, IndianRupee, LogIn, MessageCircle, Pencil, Play, Undo2, UserX, X } from 'lucide-react';
import { db } from '@/lib/db';
import { formatDate, todayISO } from '@/lib/dates';
import { inr } from '@/lib/format';
import { whatsappUrl } from '@/lib/messages';
import { NOTIFICATION_TYPES, OFFLINE_METHODS, PAYMENT_METHODS, PAYMENT_STATUS, REFUND_STATUS, UPCOMING, can, paymentState } from '@/lib/rentals/constants';
import { amountDue } from '@/lib/rentals/core';
import { bookingWhen, whatsappText } from '@/lib/rentals/notify';
import { gatewayConfig } from '@/lib/rentals/settings';
import { requireRental } from '@/lib/rentals/staff';
import { durationLabel } from '@/lib/rentals/time';
import { ConfirmAction } from '@/components/ConfirmAction';
import { FormModal } from '@/components/FormModal';
import { Empty, Panel } from '@/components/ui';
import { Check as CheckField } from '@/components/rentals/fields';
import { Reschedule } from '@/components/rentals/Reschedule';
import { Chip, LineChip, PriceLines, StatusChip, parseLines } from '@/components/rentals/ui';
import {
  approveBookingAction, cancelBookingAction, createRefundAction, declineRefundAction, editBookingAction, equipmentStep, inspectEquipment,
  moveBookingAction, processRefundAction, recordPaymentAction, rejectBookingAction, rescheduleBookingAction, staffRescheduleSlots,
} from '../actions';

const stamp = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function BookingPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await requireRental('view');
  const b = await db.rentalBooking.findUnique({
    where: { id },
    include: {
      facility: { include: { pricing: true, resources: { where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true } } } },
      package: true,
      resources: { include: { resource: { select: { name: true, code: true } } } },
      equipment: { include: { item: { select: { name: true, code: true, replacementCost: true } } } },
      payments: { orderBy: { createdAt: 'asc' } },
      refunds: { orderBy: { createdAt: 'asc' } },
      audit: { orderBy: { createdAt: 'asc' } },
      notifications: { orderBy: { createdAt: 'desc' } },
      student: { select: { id: true, name: true } },
    },
  });
  if (!b) notFound();

  const due = amountDue(b);
  const today = todayISO();
  const may = (p: Parameters<typeof can>[1]) => can(user.role, p);
  const timed = b.kind === 'FACILITY' && b.facility.pricing?.unit !== 'PER_DAY';
  const live = !['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW', 'REFUNDED', 'PENDING'].includes(b.status);
  const hasOnline = b.payments.some((p) => p.status === 'PAID' && p.gateway === 'RAZORPAY') && Boolean(gatewayConfig());
  const refundable = b.paid - b.refunds.filter((r) => r.status === 'PENDING').reduce((t, r) => t + r.amount, 0);
  const waType = b.status === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : UPCOMING.includes(b.status) ? 'BOOKING_RECEIVED' : b.status === 'CANCELLED' ? 'CANCELLED' : 'BOOKING_CONFIRMED';
  const wa = whatsappUrl(b.customerPhone, (await whatsappText(b.id, waType)) ?? undefined);

  return (
    <>
      <Link href="/bookings/list" className="back-link"><ArrowLeft size={14} /> All bookings</Link>
      <div className="rn-head">
        <div>
          <span className="eyebrow">BOOKING {b.code} · {b.source === 'STAFF' ? `ENTERED BY ${(b.createdBy ?? 'STAFF').toUpperCase()}` : 'BOOKED ONLINE'}</span>
          <h1>{b.customerName} <StatusChip status={b.status} big /></h1>
          <p>
            {b.customerPhone}{b.customerEmail ? ` · ${b.customerEmail}` : ''} · {b.customerType === 'STUDENT' ? 'Academy student' : 'Outside customer'}
            {b.student && <> · <Link className="text-btn inline" href={`/students/${b.student.id}`}>student profile</Link></>}
          </p>
          {b.status === 'PAYMENT_PENDING' && b.expiresAt && <p className="c-late">Held until {stamp(b.expiresAt)}; released automatically if the payment has not come by then.</p>}
          {b.cancelReason && <p>Reason: {b.cancelReason}</p>}
        </div>
        <div className="rn-actions">
          {wa && <a className="wa-btn big" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Send on WhatsApp</a>}
          <Link className="secondary-btn" href={`/rental-receipt/${b.id}`} target="_blank"><FileText size={15} /> Receipt</Link>
        </div>
      </div>

      {/* What can be done next, by status and by role. The server checks each of these again. */}
      <article className="panel padded spaced-bottom">
        <div className="rn-actions">
          {b.status === 'PENDING' && may('manage') && (
            <>
              <ConfirmAction action={approveBookingAction.bind(null, b.id)} confirmText={`Approve booking ${b.code}?`} className="primary-btn"><Check size={16} /> Approve</ConfirmAction>
              <FormModal title="Reject this request" trigger={<><X size={15} /> Reject</>} triggerClassName="secondary-btn danger" action={rejectBookingAction.bind(null, b.id)} submitLabel="Reject booking">
                <label>Reason (the customer sees it)<input name="reason" maxLength={200} placeholder="e.g. The ground is closed that day" /></label>
              </FormModal>
            </>
          )}
          {b.status === 'CONFIRMED' && may('checkin') && (
            <ConfirmAction action={moveBookingAction.bind(null, b.id, 'CHECKED_IN')} confirmText={`Check in ${b.customerName}?${due > 0 ? ` ₹${due} is still to pay.` : ''}`} className="primary-btn"><LogIn size={16} /> Check in</ConfirmAction>
          )}
          {b.status === 'CHECKED_IN' && may('manage') && (
            <ConfirmAction action={moveBookingAction.bind(null, b.id, 'IN_PROGRESS')} confirmText="Mark the session as started?" className="primary-btn"><Play size={16} /> Start session</ConfirmAction>
          )}
          {(b.status === 'CHECKED_IN' || b.status === 'IN_PROGRESS') && may('manage') && (
            <ConfirmAction action={moveBookingAction.bind(null, b.id, 'COMPLETED')} confirmText={`Mark this rental as completed?${due > 0 ? ` ₹${due} is still to pay.` : ''}`} className={b.status === 'IN_PROGRESS' ? 'primary-btn' : 'secondary-btn'}><CircleCheckBig size={16} /> Mark completed</ConfirmAction>
          )}
          {live && due > 0 && may('payOffline') && (
            <FormModal title="Record a payment" eyebrow={`BOOKING ${b.code}`} description={`${inr(due)} is still to pay.`} trigger={<><IndianRupee size={15} /> Record payment</>} triggerClassName={b.status === 'PAYMENT_PENDING' ? 'primary-btn' : 'secondary-btn'} action={recordPaymentAction.bind(null, b.id)} submitLabel="Record payment">
              <div className="form-row">
                <label>Amount received (₹) *<input name="amount" type="number" min={1} max={due} required defaultValue={due} /></label>
                <label>Paid by *<select name="method" defaultValue="CASH">{Object.entries(OFFLINE_METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              </div>
              <label>Reference <small className="muted">(UPI / card slip / bank reference)</small><input name="reference" maxLength={80} /></label>
              <p className="form-hint">A receipt number is given automatically. Online (Razorpay) payments are recorded by the system itself, not here.</p>
            </FormModal>
          )}
          {UPCOMING.includes(b.status) && may('manage') && (
            <>
              <Reschedule
                bookingId={b.id} timed={timed} slotsNeeded={Math.max(1, Math.round((b.endMin - b.startMin) / b.facility.slotMinutes))}
                today={today} currentDate={b.date} units={timed ? b.facility.resources : []}
                loadSlots={staffRescheduleSlots.bind(null, b.id)} action={rescheduleBookingAction}
              />
              <FormModal title="Cancel this booking" eyebrow={`BOOKING ${b.code}`} description={b.paid > 0 ? `${inr(b.paid)} has been paid. What is not kept as a charge becomes a refund to pay.` : undefined} trigger={<><Ban size={15} /> Cancel</>} triggerClassName="secondary-btn danger" action={cancelBookingAction.bind(null, b.id)} submitLabel="Cancel booking">
                <label>Reason<input name="reason" maxLength={300} placeholder="e.g. Customer called to cancel" /></label>
                <CheckField name="waiveCharge" label="Do not apply the cancellation charge" hint={b.facility.pricing?.cancelChargePct ? `Policy: free until ${b.facility.pricing.cancelFreeHours} hours before, then ${b.facility.pricing.cancelChargePct}%.` : 'This facility has no cancellation charge.'} />
              </FormModal>
            </>
          )}
          {b.status === 'CONFIRMED' && may('manage') && (
            <ConfirmAction action={moveBookingAction.bind(null, b.id, 'NO_SHOW')} confirmText="Mark as a no-show? The slot is released." className="secondary-btn"><UserX size={15} /> No-show</ConfirmAction>
          )}
          {may('manage') && (
            <FormModal title="Edit details" trigger={<><Pencil size={15} /> Notes</>} triggerClassName="secondary-btn" action={editBookingAction.bind(null, b.id)}>
              <label>Players<input name="players" type="number" min={1} max={b.facility.capacity} defaultValue={b.players ?? ''} /></label>
              <label>Customer&apos;s note<textarea name="notes" rows={2} maxLength={500} defaultValue={b.notes ?? ''} /></label>
              <label>Staff note (not shown to the customer)<textarea name="staffNotes" rows={3} maxLength={1000} defaultValue={b.staffNotes ?? ''} /></label>
              <p className="form-hint">To change the day or time use Reschedule; to change money use payments and refunds. That keeps the history honest.</p>
            </FormModal>
          )}
        </div>
      </article>

      <div className="rn-two">
        <div className="rn-stack">
          <Panel title="Booking">
            <dl className="rn-kv">
              <dt>Facility</dt><dd><b>{b.facility.name}</b>{b.package ? ` · ${b.package.name}` : ''}</dd>
              {b.resources.length > 0 && <><dt>Units</dt><dd>{b.resources.map((r) => `${r.resource.name} (${r.resource.code})${r.role === 'NET' ? ', reserved with the machine' : ''}`).join(' · ')}</dd></>}
              <dt>When</dt><dd>{bookingWhen(b)}{b.kind === 'FACILITY' ? ` · ${durationLabel(b.endMin - b.startMin)}` : ''}</dd>
              {b.players && <><dt>Players</dt><dd>{b.players}</dd></>}
              {b.rescheduleCount > 0 && <><dt>Rescheduled</dt><dd>{b.rescheduleCount} time{b.rescheduleCount === 1 ? '' : 's'}</dd></>}
              {b.notes && <><dt>Customer note</dt><dd>{b.notes}</dd></>}
              {b.staffNotes && <><dt>Staff note</dt><dd>{b.staffNotes}</dd></>}
              {b.checkedInAt && <><dt>Checked in</dt><dd>{stamp(b.checkedInAt)}</dd></>}
              {b.completedAt && <><dt>Completed</dt><dd>{stamp(b.completedAt)}</dd></>}
              <dt>Booked on</dt><dd>{stamp(b.createdAt)}</dd>
            </dl>
          </Panel>

          {b.equipment.length > 0 && (
            <Panel title="Equipment" subtitle="Reserved → issued → returned → inspected (back in stock).">
              <ul className="rn-unit-list">
                {b.equipment.map((e) => (
                  <li key={e.id}>
                    <span className="rn-code">{e.item.code}</span>
                    <div className="stack">
                      <b>{e.item.name} × {e.qty}</b>
                      <small className="muted">
                        {inr(e.unitPrice)} each{e.dueDate ? ` · due back ${formatDate(e.dueDate)}` : ''}
                        {(e.damagedQty > 0 || e.missingQty > 0) && ` · ${e.damagedQty} damaged, ${e.missingQty} missing, charged ${inr(e.charge)}`}
                        {e.note ? ` · ${e.note}` : ''}
                      </small>
                    </div>
                    {e.status === 'ISSUED' && e.dueDate && e.dueDate < today ? <Chip tone="red">Overdue</Chip> : <LineChip status={e.status} />}
                    {may('manage') && e.status === 'RESERVED' && <ConfirmAction action={equipmentStep.bind(null, e.id, 'ISSUE')} confirmText={`Hand over ${e.item.name} × ${e.qty}?`} className="secondary-btn small-btn">Issue</ConfirmAction>}
                    {may('manage') && e.status === 'ISSUED' && <ConfirmAction action={equipmentStep.bind(null, e.id, 'RETURN')} confirmText={`${e.item.name} × ${e.qty} returned?`} className="secondary-btn small-btn">Returned</ConfirmAction>}
                    {may('manage') && e.status === 'RETURNED' && (
                      <FormModal title={`Inspect ${e.item.name} × ${e.qty}`} description="Good items go back in stock. Damaged ones are taken out of service; missing ones leave the stock count." trigger="Inspect" triggerClassName="secondary-btn small-btn" action={inspectEquipment.bind(null, e.id)} submitLabel="Save inspection">
                        <div className="form-row">
                          <label>Damaged<input name="damagedQty" type="number" min={0} max={e.qty} defaultValue={0} /></label>
                          <label>Missing<input name="missingQty" type="number" min={0} max={e.qty} defaultValue={0} /></label>
                        </div>
                        <label>Charge to the customer (₹) {e.item.replacementCost > 0 && <small className="muted">(replacement cost: {inr(e.item.replacementCost)} each)</small>}<input name="charge" type="number" min={0} defaultValue={0} /></label>
                        <label>Note<input name="note" maxLength={200} placeholder="e.g. Bat handle cracked" /></label>
                      </FormModal>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Activity" subtitle="Everything that happened to this booking, and who did it.">
            <ul className="rn-timeline">
              {b.audit.map((a) => (
                <li key={a.id}><b>{a.action}</b>{a.detail && !a.detail.startsWith('{') && !a.detail.startsWith('[') ? `: ${a.detail}` : ''}<small>{stamp(a.createdAt)} · {a.actorName ?? a.actorType}</small></li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="rn-stack">
          <Panel title="Amount" subtitle={paymentState(b)}>
            <PriceLines lines={parseLines(b.priceLines)} total={b.total} deposit={b.deposit} paid={b.paid} />
            {b.cancelCharge > 0 && <p className="rn-note" style={{ marginTop: 10 }}>Cancellation charge kept: {inr(b.cancelCharge)}</p>}
          </Panel>

          <Panel
            title="Payments and refunds"
            action={may('refund') && refundable > 0 ? (
              <FormModal title="Pay money back" eyebrow={`BOOKING ${b.code}`} description={`Up to ${inr(refundable)} can be refunded.`} trigger={<><Undo2 size={14} /> Refund</>} triggerClassName="text-btn" action={createRefundAction.bind(null, b.id)} submitLabel="Add refund">
                <label>Amount (₹) *<input name="amount" type="number" min={1} max={refundable} required defaultValue={b.status === 'COMPLETED' && b.deposit > 0 ? Math.min(b.deposit, refundable) : refundable} /></label>
                <label>Reason<input name="reason" maxLength={200} defaultValue={b.status === 'COMPLETED' && b.deposit > 0 ? 'Security deposit returned' : ''} /></label>
                <p className="form-hint">This adds the refund to the list. Mark it as paid once the money has gone back.</p>
              </FormModal>
            ) : undefined}
          >
            {b.payments.length === 0 && b.refunds.length === 0 ? <Empty title="No payments yet" /> : (
              <ul className="rn-unit-list">
                {b.payments.map((p) => (
                  <li key={p.id}>
                    <div className="stack">
                      <b>{inr(p.amount)} · {PAYMENT_METHODS[p.method] ?? p.method}</b>
                      <small className="muted">{p.receiptNo ?? PAYMENT_STATUS[p.status]}{p.paidAt ? ` · ${stamp(p.paidAt)}` : ''}{p.reference ? ` · Ref ${p.reference}` : ''}{p.recordedBy ? ` · ${p.recordedBy}` : ''}</small>
                    </div>
                    <Chip tone={p.status === 'PAID' ? 'green' : p.status === 'FAILED' ? 'red' : 'amber'}>{PAYMENT_STATUS[p.status] ?? p.status}</Chip>
                  </li>
                ))}
                {b.refunds.map((r) => (
                  <li key={r.id}>
                    <div className="stack">
                      <b>Refund {inr(r.amount)}</b>
                      <small className="muted">{r.reason ?? 'No reason given'}{r.processedAt ? ` · ${stamp(r.processedAt)} · ${PAYMENT_METHODS[r.method ?? ''] ?? r.method ?? ''}${r.reference ? ` · Ref ${r.reference}` : ''} · ${r.processedBy ?? ''}` : ` · asked by ${r.requestedBy ?? 'system'}`}</small>
                    </div>
                    <Chip tone={r.status === 'PROCESSED' ? 'green' : r.status === 'REJECTED' ? 'grey' : 'amber'}>{REFUND_STATUS[r.status] ?? r.status}</Chip>
                    {r.status === 'PENDING' && may('refund') && (
                      <div className="row-actions">
                        <FormModal title={`Refund ${inr(r.amount)}`} description="Record how the money went back to the customer." trigger="Mark paid" triggerClassName="secondary-btn small-btn" action={processRefundAction.bind(null, r.id)} submitLabel="Refund paid">
                          <label>Paid back by *
                            <select name="method" defaultValue={hasOnline ? 'GATEWAY' : 'CASH'}>
                              {hasOnline && <option value="GATEWAY">Razorpay: back to the card / UPI they paid with</option>}
                              {Object.entries(OFFLINE_METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                          <label>Reference<input name="reference" maxLength={80} /></label>
                        </FormModal>
                        <FormModal title="Decline this refund" trigger={<X size={15} />} triggerClassName="icon-action danger" triggerLabel="Decline" action={declineRefundAction.bind(null, r.id)} submitLabel="Decline refund">
                          <label>Note<input name="note" maxLength={80} /></label>
                        </FormModal>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Messages to the customer" subtitle="Shown in their booking account; emailed when email is set up.">
            {b.notifications.length === 0 ? <Empty title="No messages yet" /> : (
              <ul className="rn-unit-list">
                {b.notifications.map((n) => (
                  <li key={n.id}>
                    <div className="stack"><b>{NOTIFICATION_TYPES[n.type] ?? n.title}</b><small className="muted">{stamp(n.createdAt)}{n.emailTo ? ` · ${n.emailTo}` : ''}</small></div>
                    <Chip tone={n.emailStatus === 'SENT' ? 'green' : n.emailStatus === 'FAILED' ? 'red' : 'grey'}>{n.emailStatus === 'SENT' ? 'Emailed' : n.emailStatus === 'FAILED' ? 'Email failed' : n.emailStatus === 'NOT_CONFIGURED' ? 'In app only' : 'In app'}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
