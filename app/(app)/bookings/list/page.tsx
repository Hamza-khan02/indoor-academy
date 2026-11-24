import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { inr } from '@/lib/format';
import { BOOKING_STATUS, EARNING, can } from '@/lib/rentals/constants';
import { bookingWhen } from '@/lib/rentals/notify';
import { requireRental } from '@/lib/rentals/staff';
import { Empty, PageHeader } from '@/components/ui';
import { Chip, StatusChip } from '@/components/rentals/ui';

type Search = { q?: string; status?: string; facility?: string; from?: string; to?: string; unit?: string; customer?: string; pay?: string };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function BookingListPage(props: { searchParams: Promise<Search> }) {
  const sp = await props.searchParams;
  const user = await requireRental('view');
  const q = sp.q?.trim() ?? '';
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : '';
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : '';
  const where: Prisma.RentalBookingWhereInput = {
    ...(q ? { OR: [{ code: { contains: q.toUpperCase() } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }] } : {}),
    ...(sp.status && sp.status in BOOKING_STATUS ? { status: sp.status } : {}),
    ...(sp.facility ? { facilityId: sp.facility } : {}),
    ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(sp.unit ? { resources: { some: { resourceId: sp.unit } } } : {}),
    ...(sp.customer ? { customerId: sp.customer } : {}),
  };
  const [rows, facilities, unit, customer] = await Promise.all([
    db.rentalBooking.findMany({
      where,
      orderBy: [{ date: 'desc' }, { startMin: 'desc' }],
      take: 300,
      include: { facility: { select: { name: true } }, package: { select: { name: true } }, resources: { select: { resource: { select: { name: true } } } } },
    }),
    db.rentalFacility.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    sp.unit ? db.rentalResource.findUnique({ where: { id: sp.unit }, select: { name: true, code: true } }) : null,
    sp.customer ? db.rentalCustomer.findUnique({ where: { id: sp.customer }, select: { name: true } }) : null,
  ]);
  const bookings = sp.pay === 'due' ? rows.filter((b) => [...EARNING, 'PAYMENT_PENDING'].includes(b.status) && b.total + b.deposit - b.paid > 0) : rows;
  const filtered = Boolean(q || sp.status || sp.facility || from || to || sp.unit || sp.customer || sp.pay);

  return (
    <>
      <PageHeader
        title="All bookings"
        subtitle={unit ? `Booking history of ${unit.name} (${unit.code})` : customer ? `Bookings of ${customer.name}` : 'Search, filter and open any booking.'}
        actions={can(user.role, 'create') ? <Link className="primary-btn" href="/bookings/new"><Plus size={17} /> New booking</Link> : undefined}
      />
      <form className="panel filters" method="get">
        <input name="q" defaultValue={q} placeholder="Booking ID, name or phone" aria-label="Search bookings" />
        <select name="status" defaultValue={sp.status ?? ''} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(BOOKING_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select name="facility" defaultValue={sp.facility ?? ''} aria-label="Facility">
          <option value="">Any facility</option>
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <label className="inline">From <input type="date" name="from" defaultValue={from} /></label>
        <label className="inline">To <input type="date" name="to" defaultValue={to} /></label>
        <select name="pay" defaultValue={sp.pay ?? ''} aria-label="Payment">
          <option value="">Any payment state</option>
          <option value="due">With a balance to pay</option>
        </select>
        {sp.unit && <input type="hidden" name="unit" value={sp.unit} />}
        {sp.customer && <input type="hidden" name="customer" value={sp.customer} />}
        <button className="secondary-btn">Filter</button>
        {filtered && <Link className="text-btn" href="/bookings/list">Clear</Link>}
      </form>

      <article className="panel padded">
        {bookings.length === 0 ? <Empty title={filtered ? 'No booking matches these filters' : 'No bookings yet'} /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>BOOKING</th><th>CUSTOMER</th><th>FACILITY</th><th>WHEN</th><th>STATUS</th><th className="rn-num">AMOUNT</th><th className="rn-num">PAID</th><th className="rn-num">DUE</th><th>THROUGH</th></tr></thead>
                <tbody>
                  {bookings.map((b) => {
                    const due = Math.max(0, b.total + b.deposit - b.paid);
                    const live = [...EARNING, 'PAYMENT_PENDING'].includes(b.status);
                    return (
                      <tr key={b.id}>
                        <td><Link className="text-btn" href={`/bookings/${b.id}`}>{b.code}</Link></td>
                        <td><b>{b.customerName}</b> {b.customerType === 'STUDENT' && <Chip tone="blue">Student</Chip>}<small className="muted block">{b.customerPhone}</small></td>
                        <td>{b.facility.name}<small className="muted block">{[b.package?.name, b.resources.map((r) => r.resource.name).join(' + ')].filter(Boolean).join(' · ')}</small></td>
                        <td>{bookingWhen(b)}</td>
                        <td><StatusChip status={b.status} /></td>
                        <td className="rn-num">{inr(b.total)}{b.deposit > 0 && <small className="muted block">+ {inr(b.deposit)} deposit</small>}</td>
                        <td className="rn-num">{inr(b.paid)}</td>
                        <td className="rn-num">{live && due > 0 ? <span className="c-absent">{inr(due)}</span> : '—'}</td>
                        <td>{b.source === 'STAFF' ? 'Staff' : 'Online'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-bottom"><span>Showing <b>{bookings.length}</b> booking{bookings.length === 1 ? '' : 's'}{rows.length === 300 ? ' (the newest 300; narrow the dates to see older ones)' : ''}</span></div>
          </>
        )}
      </article>
    </>
  );
}
