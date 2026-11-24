import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Wrench } from 'lucide-react';
import { db } from '@/lib/db';
import { addDays, formatDate, formatLongDate, todayISO } from '@/lib/dates';
import { dayGrid, rangeBookings } from '@/lib/rentals/availability';
import { BOOKING_STATUS, can, slotState } from '@/lib/rentals/constants';
import { requireRental } from '@/lib/rentals/staff';
import { rangeLabel, timeLabel } from '@/lib/rentals/time';
import { Empty, PageHeader } from '@/components/ui';
import { Legend } from '@/components/rentals/ui';

type View = 'day' | 'week' | 'month';
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const mondayOf = (iso: string) => addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7));
const monthLong = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default async function CalendarPage(props: { searchParams: Promise<{ view?: string; date?: string; facility?: string; denied?: string }> }) {
  const sp = await props.searchParams;
  const user = await requireRental('schedule');
  const today = todayISO();
  const view: View = sp.view === 'week' || sp.view === 'month' ? sp.view : 'day';
  const date = sp.date && DATE_RE.test(sp.date) ? sp.date : today;
  const canView = can(user.role, 'view');
  const canCreate = can(user.role, 'create');
  const canConfig = can(user.role, 'config');

  const facilities = await db.rentalFacility.findMany({ where: { status: { not: 'INACTIVE' }, category: { not: 'EQUIPMENT' } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } });
  const facilityId = facilities.some((f) => f.id === sp.facility) ? sp.facility! : view === 'day' ? facilities[0]?.id : '';
  const link = (over: { view?: View; date?: string; facility?: string }) => {
    const p = new URLSearchParams({ view: over.view ?? view, date: over.date ?? date });
    const f = over.facility ?? facilityId;
    if (f) p.set('facility', f);
    return `/bookings/calendar?${p}`;
  };
  const step = view === 'day' ? 1 : view === 'week' ? 7 : 0;
  const shift = (n: number) => {
    if (view !== 'month') return addDays(date, n * step);
    const d = new Date(date.slice(0, 8) + '01T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  };

  const tools = (title: string) => (
    <div className="rn-cal-tools">
      <div className="seg-links">
        {(['day', 'week', 'month'] as View[]).map((v) => <Link key={v} href={link({ view: v })} className={v === view ? 'on' : undefined}>{v === 'day' ? 'Daily' : v === 'week' ? 'Weekly' : 'Monthly'}</Link>)}
      </div>
      <Link className="icon-button" href={link({ date: shift(-1) })} aria-label="Earlier"><ChevronLeft size={17} /></Link>
      <strong>{title}</strong>
      <Link className="icon-button" href={link({ date: shift(1) })} aria-label="Later"><ChevronRight size={17} /></Link>
      {date !== today && <Link className="secondary-btn small-btn" href={link({ date: today })}>Today</Link>}
      <form method="get" style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
        <input type="hidden" name="view" value={view} />
        <input type="date" name="date" defaultValue={date} aria-label="Date" />
        <select name="facility" defaultValue={facilityId ?? ''} aria-label="Facility">
          {view !== 'day' && <option value="">All facilities</option>}
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button className="secondary-btn small-btn">Show</button>
      </form>
    </div>
  );
  const header = (
    <PageHeader
      title="Booking calendar"
      subtitle={canView ? 'Click a free slot to book it, or a booking to open it.' : 'Facility schedules.'}
      actions={
        <>
          {canConfig && facilityId && <Link className="secondary-btn" href={`/bookings/facilities/${facilityId}`}><Wrench size={16} /> Block time / maintenance</Link>}
          {canCreate && <Link className="primary-btn" href={`/bookings/new${facilityId ? `?facility=${facilityId}&date=${date}` : ''}`}><Plus size={17} /> New booking</Link>}
        </>
      }
    />
  );
  const denied = sp.denied ? <p className="rn-note warn spaced-bottom">Your role can see schedules only.</p> : null;

  if (facilities.length === 0) {
    return <>{header}<article className="panel padded"><Empty title="No facilities to show">Facilities appear here once an administrator adds them.</Empty></article></>;
  }

  // ---------------- Daily: one column per unit, one row per slot ----------------
  if (view === 'day') {
    const grid = await dayGrid(facilityId!, date);
    return (
      <>
        {header}{denied}
        {tools(formatLongDate(date))}
        {!grid || grid.resources.length === 0 ? <article className="panel padded"><Empty title="This facility has no units yet" /></article> : (
          <div className="rn-cal">
            <table>
              <thead>
                <tr><th>Time</th>{grid.resources.map((r) => <th key={r.id}>{r.name}<small>{r.code}</small></th>)}</tr>
              </thead>
              <tbody>
                {grid.starts.map((t) => (
                  <tr key={t}>
                    <th>{timeLabel(t)}</th>
                    {grid.resources.map((r) => {
                      const cell = grid.cells[r.id][t];
                      const cls = `rn-cell s-${cell.state}`;
                      if (cell.booking) {
                        const first = cell.booking.startMin >= t && cell.booking.startMin < t + grid.facility.slotMinutes;
                        const body = canView
                          ? <><b>{cell.booking.name}</b><small>{first ? `${cell.booking.code} · ${rangeLabel(cell.booking.startMin, cell.booking.endMin)}` : 'continues'}</small></>
                          : <><b>{BOOKING_STATUS[cell.booking.status]?.label ?? 'Booked'}</b><small>{rangeLabel(cell.booking.startMin, cell.booking.endMin)}</small></>;
                        return <td key={r.id}>{canView ? <Link className={cls} href={`/bookings/${cell.booking.id}`}>{body}</Link> : <span className={cls}>{body}</span>}</td>;
                      }
                      if (cell.state === 'BLOCKED') return <td key={r.id}><span className={cls}><b>Not available</b><small>{cell.reason}</small></span></td>;
                      if (cell.state === 'AVAILABLE' && canCreate) {
                        return <td key={r.id}><Link className={cls} href={`/bookings/new?facility=${facilityId}&date=${date}&start=${t}&unit=${r.id}`} aria-label={`Book ${r.name} at ${timeLabel(t)}`}><b>Available</b><small>Click to book</small></Link></td>;
                      }
                      return <td key={r.id}><span className={cls}><b>{cell.state === 'AVAILABLE' ? 'Available' : ''}</b></span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 12 }}><Legend /></div>
      </>
    );
  }

  // ---------------- Weekly and monthly: bookings per day ----------------
  const from = view === 'week' ? mondayOf(date) : mondayOf(date.slice(0, 8) + '01');
  const monthEnd = (() => { const d = new Date(date.slice(0, 8) + '01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); })();
  const to = view === 'week' ? addDays(from, 6) : addDays(mondayOf(monthEnd), 6);
  const { bookings, blockouts } = await rangeBookings(from, to, facilityId || null);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const blockedOn = (d: string) => blockouts.filter((b) => b.fromDate <= d && b.toDate >= d);

  return (
    <>
      {header}{denied}
      {tools(view === 'week' ? `${formatDate(from)} – ${formatDate(to)}` : monthLong(date))}
      <div className={view === 'week' ? 'rn-week' : 'rn-month'}>
        {view === 'month' && DOW.map((d) => <div key={d} className="rn-dow">{d.toUpperCase()}</div>)}
        {days.map((d) => {
          const list = bookings.filter((b) => b.date === d);
          const blocks = blockedOn(d);
          const other = view === 'month' && d.slice(0, 7) !== date.slice(0, 7);
          const count = (state: string) => list.filter((b) => (b.status === 'COMPLETED' ? 'BOOKED' : slotState(b.status)) === state).length;
          return (
            <div key={d} className={`rn-day${d === today ? ' today' : ''}${other ? ' other' : ''}`}>
              <div className="rn-day-head">
                <Link href={link({ view: 'day', date: d, facility: facilityId || facilities[0].id })}><b>{Number(d.slice(8))}</b></Link>
                <span>{view === 'week' ? DOW[days.indexOf(d) % 7] : list.length > 0 ? `${list.length} booking${list.length === 1 ? '' : 's'}` : ''}</span>
              </div>
              {view === 'week' ? (
                <>
                  {blocks.map((b) => <span key={b.id} className="rn-ev s-BLOCKED"><b>{b.startMin !== null && b.endMin !== null ? rangeLabel(b.startMin, b.endMin) : 'All day'}</b> {b.resource?.name ?? b.facility.name}: {b.reason || (b.kind === 'MAINTENANCE' ? 'Maintenance' : 'Blocked')}</span>)}
                  {list.length === 0 && blocks.length === 0 && <small className="muted">No bookings</small>}
                  {list.map((b) => {
                    const cls = `rn-ev s-${b.status === 'COMPLETED' ? 'BOOKED' : slotState(b.status)}`;
                    const text = <><b>{b.kind === 'EQUIPMENT' ? 'Equipment' : timeLabel(b.startMin)}</b> {canView ? b.customerName : BOOKING_STATUS[b.status]?.label} · {b.resources.map((r) => r.resource.name).join('+') || b.facility.name}</>;
                    return canView ? <Link key={b.id} className={cls} href={`/bookings/${b.id}`} title={`${b.code} · ${b.facility.name}`}>{text}</Link> : <span key={b.id} className={cls}>{text}</span>;
                  })}
                </>
              ) : (
                <div className="rn-dots">
                  {count('BOOKED') > 0 && <span className="t-red">{count('BOOKED')} booked</span>}
                  {count('PENDING') > 0 && <span className="t-amber">{count('PENDING')} pending</span>}
                  {count('CHECKED_IN') > 0 && <span className="t-blue">{count('CHECKED_IN')} checked in</span>}
                  {blocks.length > 0 && <span className="t-grey">blocked</span>}
                  {list.length === 0 && blocks.length === 0 && !other && d >= today && <span className="t-green">free</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}><Legend /></div>
    </>
  );
}
