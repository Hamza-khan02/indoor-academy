import { CalendarRange, Download, IndianRupee, Wallet, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { inr, inrCompact } from '@/lib/format';
import { buildReports, reportRange, reportTotals } from '@/lib/rentals/reports';
import { requireRental } from '@/lib/rentals/staff';
import { Empty, PageHeader, Panel, StatCard } from '@/components/ui';

export default async function RentalReportsPage(props: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await props.searchParams;
  await requireRental('reports');
  const { from, to } = reportRange(sp.from, sp.to);
  const [reports, totals] = await Promise.all([buildReports(from, to), reportTotals(from, to)]);
  const csv = (key: string) => `/api/rentals/export/${key}?from=${from}&to=${to}`;

  return (
    <>
      <PageHeader title="Booking reports" subtitle={`${formatDate(from)} to ${formatDate(to)}. Revenue counts bookings that went ahead; collected counts money actually received.`} />
      <form className="panel filters" method="get">
        <label className="inline">From <input type="date" name="from" defaultValue={from} required /></label>
        <label className="inline">To <input type="date" name="to" defaultValue={to} required /></label>
        <button className="secondary-btn">Show</button>
        <a className="secondary-btn" href={csv('bookings')} style={{ marginLeft: 'auto' }}><Download size={15} /> All bookings (CSV for Excel)</a>
      </form>

      <div className="stats-grid">
        <StatCard title="Bookings" value={String(totals.bookings)} detail={`${totals.wentAhead} went ahead`} icon={<CalendarRange size={17} />} color="blue" />
        <StatCard title="Revenue" value={inrCompact(totals.revenue)} detail="from bookings that went ahead" icon={<IndianRupee size={17} />} color="green" />
        <StatCard title="Collected" value={inrCompact(totals.collected)} detail="received, after refunds" icon={<Wallet size={17} />} color="amber" />
        <StatCard title="Cancelled" value={String(totals.cancelled)} detail="cancelled, rejected or refunded" icon={<XCircle size={17} />} color="red" />
      </div>

      {reports.filter((r) => r.key !== 'bookings').map((r) => (
        <Panel key={r.key} title={r.title} subtitle={r.description} className="spaced-bottom" action={<a className="text-btn" href={csv(r.key)}><Download size={14} /> CSV</a>}>
          {r.rows.length === 0 ? <Empty title="Nothing in this period" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr>{r.columns.map((c, i) => <th key={c} className={i > 0 && typeof r.rows[0][i] === 'number' ? 'rn-num' : undefined}>{c.toUpperCase()}</th>)}</tr></thead>
                <tbody>
                  {r.rows.slice(0, 100).map((row, n) => (
                    <tr key={n}>
                      {row.map((v, i) => (
                        <td key={i} className={typeof v === 'number' ? 'rn-num' : i === 0 ? undefined : 'wrap'}>
                          {typeof v === 'number' && r.money?.includes(i) ? (v < 0 ? `− ${inr(-v)}` : inr(v)) : i === 0 ? <b>{v}</b> : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.rows.length > 100 && <p className="muted small-note" style={{ marginTop: 10 }}>Showing the first 100 of {r.rows.length} rows. Download the CSV for all of them.</p>}
            </div>
          )}
        </Panel>
      ))}
    </>
  );
}
