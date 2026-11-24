import Link from 'next/link';
import { ArrowRight, Ban, Banknote, Boxes, CalendarCheck, CalendarDays, CalendarRange, IndianRupee, Plus, Warehouse } from 'lucide-react';
import { db } from '@/lib/db';
import { formatDate, todayISO } from '@/lib/dates';
import { inr, inrCompact } from '@/lib/format';
import { EARNING, HOLDING, can } from '@/lib/rentals/constants';
import { bookingWhen } from '@/lib/rentals/notify';
import { requireRental } from '@/lib/rentals/staff';
import { rangeLabel } from '@/lib/rentals/time';
import { Empty, PageHeader, Panel, StatCard } from '@/components/ui';
import { StatusChip } from '@/components/rentals/ui';

export default async function BookingsOverview(props: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await props.searchParams;
  const user = await requireRental('view');
  const today = todayISO();
  const month = today.slice(0, 7);
  const money = can(user.role, 'reports');

  const [total, todayCount, monthCount, cancelled, paid, refunded, open, facilities, rented, todays, attention, recent] = await Promise.all([
    db.rentalBooking.count(),
    db.rentalBooking.count({ where: { date: today, status: { in: [...HOLDING, 'COMPLETED'] } } }),
    db.rentalBooking.count({ where: { date: { startsWith: month } } }),
    db.rentalBooking.count({ where: { status: { in: ['CANCELLED', 'REFUNDED'] } } }),
    db.rentalPayment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    db.rentalRefund.aggregate({ where: { status: 'PROCESSED' }, _sum: { amount: true } }),
    db.rentalBooking.findMany({ where: { status: { in: [...EARNING, 'PAYMENT_PENDING'] } }, select: { total: true, deposit: true, paid: true } }),
    db.rentalFacility.groupBy({ by: ['status'], _count: { _all: true } }),
    db.bookingEquipment.aggregate({ where: { status: 'ISSUED' }, _sum: { qty: true } }),
    db.rentalBooking.findMany({
      where: { date: today, status: { in: [...HOLDING, 'COMPLETED'] } },
      orderBy: { startMin: 'asc' },
      include: { facility: { select: { name: true } }, resources: { select: { resource: { select: { name: true } } } } },
    }),
    db.rentalBooking.findMany({
      where: { OR: [{ status: 'PENDING' }, { status: 'PAYMENT_PENDING' }, { refunds: { some: { status: 'PENDING' } } }] },
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      take: 12,
      include: { facility: { select: { name: true } }, refunds: { where: { status: 'PENDING' }, select: { amount: true } } },
    }),
    db.rentalBooking.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { facility: { select: { name: true } } } }),
  ]);
  const pendingDue = open.reduce((t, b) => t + Math.max(0, b.total + b.deposit - b.paid), 0);
  const openFacilities = facilities.find((f) => f.status === 'ACTIVE')?._count._all ?? 0;
  const allFacilities = facilities.reduce((t, f) => t + f._count._all, 0);
  const revenue = (paid._sum.amount ?? 0) - (refunded._sum.amount ?? 0);

  return (
    <>
      <PageHeader
        title="Bookings & rentals"
        subtitle="Nets, turf, practice pitches, bowling machines and equipment."
        actions={
          <>
            <Link className="secondary-btn" href="/bookings/calendar"><CalendarDays size={17} /> Calendar</Link>
            {can(user.role, 'create') && <Link className="primary-btn" href="/bookings/new"><Plus size={17} /> New booking</Link>}
          </>
        }
      />
      {denied && <p className="rn-note warn spaced-bottom">Your role does not have access to that page.</p>}
      {allFacilities === 0 && can(user.role, 'config') && (
        <div className="section-banner">
          <div className="banner-icon"><Warehouse size={18} /></div>
          <div>
            <b>Start by adding what the academy rents out</b>
            <p>Add facilities, then set their prices under Pricing and open them for booking. Customers can then book at /book.</p>
          </div>
          <Link className="primary-btn" href="/bookings/facilities" style={{ marginLeft: 'auto' }}>Add facilities</Link>
        </div>
      )}

      <div className="stats-grid">
        <StatCard title="Total bookings" value={String(total)} detail="all time" icon={<CalendarRange size={17} />} color="blue" />
        <StatCard title="Today's bookings" value={String(todayCount)} detail={formatDate(today)} icon={<CalendarCheck size={17} />} color="green" />
        <StatCard title="This month" value={String(monthCount)} detail="bookings dated this month" icon={<CalendarDays size={17} />} color="amber" />
        <StatCard title="Rental revenue" value={money ? inrCompact(revenue) : '—'} detail={money ? 'received, after refunds' : 'visible to administrators'} icon={<IndianRupee size={17} />} color="red" />
      </div>
      <div className="stats-grid">
        <StatCard title="Pending payments" value={inrCompact(pendingDue)} detail={`${open.filter((b) => b.total + b.deposit - b.paid > 0).length} bookings with a balance`} icon={<Banknote size={17} />} color="amber" />
        <StatCard title="Available facilities" value={`${openFacilities} / ${allFacilities}`} detail="open for booking" icon={<Warehouse size={17} />} color="green" />
        <StatCard title="Cancelled bookings" value={String(cancelled)} detail="all time" icon={<Ban size={17} />} color="red" />
        <StatCard title="Equipment rented" value={String(rented._sum.qty ?? 0)} detail="items out with customers now" icon={<Boxes size={17} />} color="blue" />
      </div>

      <div className="two-col wide-left">
        <Panel title="Today's schedule" subtitle={formatDate(today)} action={<Link className="text-btn" href={`/bookings/list?from=${today}&to=${today}`}>View all <ArrowRight size={13} /></Link>}>
          {todays.length === 0 ? <Empty title="No bookings today" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>TIME</th><th>BOOKING</th><th>CUSTOMER</th><th>WHERE</th><th>STATUS</th><th className="rn-num">DUE</th></tr></thead>
                <tbody>
                  {todays.map((b) => (
                    <tr key={b.id}>
                      <td>{b.kind === 'EQUIPMENT' ? 'Equipment' : rangeLabel(b.startMin, b.endMin)}</td>
                      <td><Link className="text-btn" href={`/bookings/${b.id}`}>{b.code}</Link></td>
                      <td><b>{b.customerName}</b><small className="muted block">{b.customerPhone}</small></td>
                      <td>{b.facility.name}{b.resources.length > 0 && <small className="muted block">{b.resources.map((r) => r.resource.name).join(' + ')}</small>}</td>
                      <td><StatusChip status={b.status} /></td>
                      <td className="rn-num">{b.total + b.deposit - b.paid > 0 ? <span className="c-absent">{inr(b.total + b.deposit - b.paid)}</span> : <span className="c-present">Paid</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Needs attention" subtitle="Requests to approve, payments awaited and refunds to pay.">
          {attention.length === 0 ? <Empty title="Nothing waiting" /> : (
            <ul className="rn-unit-list">
              {attention.map((b) => {
                const refund = b.refunds.reduce((t, r) => t + r.amount, 0);
                return (
                  <li key={b.id}>
                    <div className="stack">
                      <b><Link href={`/bookings/${b.id}`}>{b.code} · {b.customerName}</Link></b>
                      <small className="muted">{b.facility.name} · {bookingWhen(b)}</small>
                      {refund > 0 && <small className="c-absent">Refund of {inr(refund)} to pay</small>}
                    </div>
                    <StatusChip status={b.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Latest bookings" action={<Link className="text-btn" href="/bookings/list">All bookings <ArrowRight size={13} /></Link>}>
        {recent.length === 0 ? <Empty title="No bookings yet">Bookings made by customers and staff appear here.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>BOOKING</th><th>CUSTOMER</th><th>FACILITY</th><th>WHEN</th><th>STATUS</th><th className="rn-num">AMOUNT</th><th>THROUGH</th></tr></thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id}>
                    <td><Link className="text-btn" href={`/bookings/${b.id}`}>{b.code}</Link></td>
                    <td>{b.customerName}</td>
                    <td>{b.facility.name}</td>
                    <td>{bookingWhen(b)}</td>
                    <td><StatusChip status={b.status} /></td>
                    <td className="rn-num">{inr(b.total)}</td>
                    <td>{b.source === 'STAFF' ? `Staff${b.createdBy ? ` (${b.createdBy})` : ''}` : 'Online'}</td>
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
