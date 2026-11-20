import { Download } from 'lucide-react';
import { db } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth';
import { AGE_GROUPS } from '@/lib/constants';
import { addDays, lastNMonths, monthLabel, todayISO } from '@/lib/dates';
import { inr, percent } from '@/lib/format';
import { attended } from '@/lib/queries';
import { AttendanceBar, Empty, PageHeader, Panel } from '@/components/ui';

export default async function ReportsPage() {
  await requireAdminPage();
  const months = lastNMonths(6);
  const since = addDays(todayISO(), -29);

  const [payments, attendance, batches, byAge, byBranch, branches] = await Promise.all([
    db.feePayment.groupBy({ by: ['forMonth'], where: { forMonth: { gte: months[0] } }, _sum: { amount: true }, _count: { _all: true } }),
    db.attendance.groupBy({ by: ['batchId', 'status'], where: { date: { gte: since } }, _count: { _all: true } }),
    db.batch.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, ageGroup: true } }),
    db.student.groupBy({ by: ['ageGroup'], where: { status: { not: 'INACTIVE' } }, _count: { _all: true } }),
    db.student.groupBy({ by: ['branchId'], where: { status: { not: 'INACTIVE' } }, _count: { _all: true } }),
    db.branch.findMany({ select: { id: true, name: true } }),
  ]);

  const monthly = months.map((m) => {
    const row = payments.find((p) => p.forMonth === m);
    return { month: m, amount: row?._sum.amount ?? 0, count: row?._count._all ?? 0 };
  }).reverse();
  const maxMonth = Math.max(...monthly.map((m) => m.amount), 1);

  const batchAtt = batches.map((b) => {
    let a = 0, t = 0;
    for (const r of attendance) if (r.batchId === b.id) { t += r._count._all; if (attended(r.status)) a += r._count._all; }
    return { ...b, pct: percent(a, t), sessions: t };
  });

  const totalActive = byAge.reduce((s, r) => s + r._count._all, 0);
  const ageRows = AGE_GROUPS.map((g) => ({ label: g, count: byAge.find((r) => r.ageGroup === g)?._count._all ?? 0 })).filter((r) => r.count > 0);
  const branchRows = branches.map((b) => ({ label: b.name, count: byBranch.find((r) => r.branchId === b.id)?._count._all ?? 0 }));

  return (
    <>
      <PageHeader title="Reports & insights" subtitle="Summaries from your academy data. Download full records as CSV for Excel." />
      <div className="export-row">
        <a className="secondary-btn" href="/api/export/students"><Download size={15} /> Students CSV</a>
        <a className="secondary-btn" href="/api/export/payments"><Download size={15} /> Fee payments CSV</a>
        <a className="secondary-btn" href="/api/export/attendance"><Download size={15} /> Attendance CSV (90 days)</a>
      </div>

      <div className="two-col">
        <Panel title="Fee collection" subtitle="By fee month, last 6 months">
          <ul className="bar-list">
            {monthly.map((m) => (
              <li key={m.month}>
                <span>{monthLabel(m.month)}</span>
                <div className="progress"><span className="red" style={{ width: `${(m.amount / maxMonth) * 100}%` }} /></div>
                <b>{inr(m.amount)}</b>
                <small className="muted">{m.count} payments</small>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Attendance by batch" subtitle="Last 30 days">
          {batchAtt.length === 0 ? <Empty title="No batches yet" /> : (
            <ul className="bar-list">
              {batchAtt.map((b) => (
                <li key={b.id}>
                  <span>{b.name} <small className="muted">{b.ageGroup}</small></span>
                  <AttendanceBar pct={b.pct} />
                  <small className="muted">{b.sessions} marks</small>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="two-col">
        <Panel title="Students by age group" subtitle={`${totalActive} active students`}>
          {ageRows.length === 0 ? <Empty title="No students yet" /> : (
            <ul className="bar-list">
              {ageRows.map((r) => (
                <li key={r.label}><span>{r.label}</span><div className="progress"><span className="white" style={{ width: `${(r.count / totalActive) * 100}%` }} /></div><b>{r.count}</b></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Students by branch" subtitle={`${totalActive} active students`}>
          {branchRows.length === 0 ? <Empty title="No branches yet" /> : (
            <ul className="bar-list">
              {branchRows.map((r) => (
                <li key={r.label}><span>{r.label}</span><div className="progress"><span className="gray" style={{ width: `${totalActive ? (r.count / totalActive) * 100 : 0}%` }} /></div><b>{r.count}</b></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
