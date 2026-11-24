import Link from 'next/link';
import { Banknote, HandCoins, Undo2, Wallet, X } from 'lucide-react';
import { db } from '@/lib/db';
import { todayISO } from '@/lib/dates';
import { inr, inrCompact } from '@/lib/format';
import { EARNING, OFFLINE_METHODS, PAYMENT_METHODS } from '@/lib/rentals/constants';
import { gatewayConfig } from '@/lib/rentals/settings';
import { requireRental } from '@/lib/rentals/staff';
import { FormModal } from '@/components/FormModal';
import { Empty, PageHeader, Panel, StatCard } from '@/components/ui';
import { StatusChip } from '@/components/rentals/ui';
import { declineRefundAction, processRefundAction } from '../actions';

const stamp = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function PaymentsPage() {
  await requireRental('refund');
  const today = todayISO();
  const dayStart = new Date(`${today}T00:00:00+05:30`);
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+05:30`);
  const online = Boolean(gatewayConfig());
  const [todayPaid, monthPaid, monthRefunded, open, refunds, payments, log] = await Promise.all([
    db.rentalPayment.aggregate({ where: { status: 'PAID', paidAt: { gte: dayStart } }, _sum: { amount: true }, _count: true }),
    db.rentalPayment.aggregate({ where: { status: 'PAID', paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.rentalRefund.aggregate({ where: { status: 'PROCESSED', processedAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.rentalBooking.findMany({
      where: { status: { in: [...EARNING, 'PAYMENT_PENDING'] } },
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      select: { id: true, code: true, customerName: true, customerPhone: true, status: true, date: true, total: true, deposit: true, paid: true, facility: { select: { name: true } } },
    }),
    db.rentalRefund.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, include: { booking: { select: { id: true, code: true, customerName: true, customerPhone: true, payments: { where: { status: 'PAID', gateway: 'RAZORPAY' }, select: { id: true } } } } } }),
    db.rentalPayment.findMany({ where: { status: 'PAID' }, orderBy: { paidAt: 'desc' }, take: 40, include: { booking: { select: { id: true, code: true, customerName: true } } } }),
    db.rentalAuditLog.findMany({ where: { entity: { in: ['PAYMENT', 'REFUND'] } }, orderBy: { createdAt: 'desc' }, take: 40, include: { booking: { select: { id: true, code: true } } } }),
  ]);
  const due = open.map((b) => ({ ...b, due: b.total + b.deposit - b.paid })).filter((b) => b.due > 0);
  const refundTotal = refunds.reduce((t, r) => t + r.amount, 0);

  return (
    <>
      <PageHeader title="Payments" subtitle="Money received for bookings, balances still to collect, refunds to pay and the payment audit log." />
      <div className="stats-grid">
        <StatCard title="Collected today" value={inrCompact(todayPaid._sum.amount ?? 0)} detail={`${todayPaid._count} payment${todayPaid._count === 1 ? '' : 's'}`} icon={<Wallet size={17} />} color="green" />
        <StatCard title="Collected this month" value={inrCompact((monthPaid._sum.amount ?? 0) - (monthRefunded._sum.amount ?? 0))} detail={`after ${inr(monthRefunded._sum.amount ?? 0)} of refunds`} icon={<Banknote size={17} />} color="blue" />
        <StatCard title="Balances to collect" value={inrCompact(due.reduce((t, b) => t + b.due, 0))} detail={`${due.length} booking${due.length === 1 ? '' : 's'}`} icon={<HandCoins size={17} />} color="amber" />
        <StatCard title="Refunds to pay" value={inrCompact(refundTotal)} detail={`${refunds.length} waiting`} icon={<Undo2 size={17} />} color="red" />
      </div>

      <div className="two-col">
        <Panel title="Refunds to pay" subtitle="Created by cancellations, rejected requests, late payments and deposit returns.">
          {refunds.length === 0 ? <Empty title="No refunds waiting" /> : (
            <ul className="rn-unit-list">
              {refunds.map((r) => {
                const viaGateway = online && r.booking.payments.length > 0;
                return (
                  <li key={r.id}>
                    <div className="stack">
                      <b>{inr(r.amount)} · <Link href={`/bookings/${r.booking.id}`}>{r.booking.code}</Link></b>
                      <small className="muted">{r.booking.customerName} · {r.booking.customerPhone} · {r.reason ?? 'No reason given'}</small>
                    </div>
                    <div className="row-actions">
                      <FormModal title={`Refund ${inr(r.amount)}`} description={`To ${r.booking.customerName}. Record how the money went back.`} trigger="Mark paid" triggerClassName="secondary-btn small-btn" action={processRefundAction.bind(null, r.id)} submitLabel="Refund paid">
                        <label>Paid back by *
                          <select name="method" defaultValue={viaGateway ? 'GATEWAY' : 'CASH'}>
                            {viaGateway && <option value="GATEWAY">Razorpay: back to the card / UPI they paid with</option>}
                            {Object.entries(OFFLINE_METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </label>
                        <label>Reference<input name="reference" maxLength={80} /></label>
                      </FormModal>
                      <FormModal title="Decline this refund" trigger={<X size={15} />} triggerClassName="icon-action danger" triggerLabel="Decline" action={declineRefundAction.bind(null, r.id)} submitLabel="Decline refund">
                        <label>Note<input name="note" maxLength={80} /></label>
                      </FormModal>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Balances to collect" subtitle="Open a booking to record its payment." action={<Link className="text-btn" href="/bookings/list?pay=due">Open as a list</Link>}>
          {due.length === 0 ? <Empty title="Nothing is due" /> : (
            <ul className="rn-unit-list">
              {due.slice(0, 15).map((b) => (
                <li key={b.id}>
                  <div className="stack">
                    <b><Link href={`/bookings/${b.id}`}>{b.code} · {b.customerName}</Link></b>
                    <small className="muted">{b.facility.name} · {b.customerPhone} · paid {inr(b.paid)} of {inr(b.total + b.deposit)}</small>
                  </div>
                  <StatusChip status={b.status} />
                  <span className="rn-money c-absent">{inr(b.due)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Payments received" subtitle="The latest 40. Use Reports for a date range and a download." className="spaced-bottom">
        {payments.length === 0 ? <Empty title="No payments yet" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>RECEIPT NO.</th><th>WHEN</th><th>BOOKING</th><th>CUSTOMER</th><th>METHOD</th><th>REFERENCE</th><th>RECORDED BY</th><th className="rn-num">AMOUNT</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td><Link className="text-btn" href={`/rental-receipt/${p.booking.id}`} target="_blank">{p.receiptNo ?? '—'}</Link></td>
                    <td>{p.paidAt ? stamp(p.paidAt) : '—'}</td>
                    <td><Link className="text-btn" href={`/bookings/${p.booking.id}`}>{p.booking.code}</Link></td>
                    <td>{p.booking.customerName}</td>
                    <td>{PAYMENT_METHODS[p.method] ?? p.method}</td>
                    <td>{p.reference ?? '—'}</td>
                    <td>{p.recordedBy ?? (p.gateway ? 'Razorpay (verified)' : '—')}</td>
                    <td className="rn-num">{inr(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Payment audit log" subtitle="Every payment and refund event, who did it and when. Entries are never edited or deleted.">
        {log.length === 0 ? <Empty title="No entries yet" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>WHEN</th><th>EVENT</th><th>BOOKING</th><th>BY</th><th>DETAILS</th></tr></thead>
              <tbody>
                {log.map((a) => (
                  <tr key={a.id}>
                    <td>{stamp(a.createdAt)}</td>
                    <td><b>{a.action}</b></td>
                    <td>{a.booking ? <Link className="text-btn" href={`/bookings/${a.booking.id}`}>{a.booking.code}</Link> : '—'}</td>
                    <td>{a.actorName ?? a.actorType}</td>
                    <td className="wrap muted">{a.detail ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
