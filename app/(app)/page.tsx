import Link from 'next/link';
import { Activity, ArrowRight, CalendarDays, CircleDollarSign, ClipboardCheck, Dumbbell, Plus, ShieldAlert, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { photoUrl } from '@/lib/photos';
import { requireUser } from '@/lib/auth';
import { ATTENDANCE_TARGET } from '@/lib/constants';
import { addDays, addMonths, currentMonth, formatDate, formatTime, greeting, lastNDays, lastNMonths, todayISO, weekdayShort } from '@/lib/dates';
import { inrCompact, percent } from '@/lib/format';
import { attendanceByDay, attendanceByStudent, attended, formOptions } from '@/lib/queries';
import { AttendanceChart } from '@/components/AttendanceChart';
import { FormModal } from '@/components/FormModal';
import { AttendanceBar, Avatar, Empty, PageHeader, Panel, StatCard, StatusPill, type Trend } from '@/components/ui';
import { StudentFields } from './students/StudentFields';
import { createStudent } from './students/actions';

function diffTrend(now: number | null, before: number | null, unit: string): Trend {
  if (now === null || before === null) return null;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return { text: `0${unit}`, direction: 'flat' };
  return { text: `${d > 0 ? '+' : ''}${d}${unit}`, direction: d > 0 ? 'up' : 'down' };
}

export default async function OverviewPage({ searchParams }: { searchParams: { range?: string; denied?: string } }) {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const today = todayISO();
  const month = currentMonth();
  const range = searchParams.range === '30' ? 30 : 7;
  const since30 = addDays(today, -29);
  const weekday = weekdayShort(today);

  const days = lastNDays(range * 2);
  const [students, batches, branches, dayStats, branchAtt, monthPayments, options] = await Promise.all([
    db.student.findMany({
      where: { status: { not: 'INACTIVE' } },
      select: { id: true, name: true, ageGroup: true, playingRole: true, status: true, joinedOn: true, createdAt: true, branchId: true, photoUpdatedAt: true, batch: { select: { name: true } } },
    }),
    db.batch.findMany({
      where: { active: true },
      orderBy: { startTime: 'asc' },
      include: { coach: { select: { name: true } }, branch: { select: { name: true } }, _count: { select: { students: { where: { status: { not: 'INACTIVE' } } } } } },
    }),
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    attendanceByDay(days),
    db.attendance.findMany({ where: { date: { gte: since30 } }, select: { status: true, student: { select: { branchId: true } } } }),
    isAdmin
      ? db.feePayment.findMany({ where: { paidOn: { gte: `${lastNMonths(8)[0]}-01` } }, select: { amount: true, paidOn: true } })
      : Promise.resolve([] as { amount: number; paidOn: string }[]),
    formOptions(),
  ]);

  // Players
  const newThisMonth = students.filter((s) => s.joinedOn.startsWith(month)).length;
  const playerSpark = lastNMonths(8).map((m) => students.filter((s) => s.joinedOn.slice(0, 7) <= m).length);

  // Attendance today vs yesterday
  const todayStat = dayStats[dayStats.length - 1];
  const yesterday = dayStats[dayStats.length - 2];

  // Chart: current period vs previous period
  const current = dayStats.slice(range);
  const previous = dayStats.slice(0, range);
  const periodPct = (rows: typeof dayStats) => percent(rows.reduce((s, r) => s + r.attended, 0), rows.reduce((s, r) => s + r.total, 0));
  const avgNow = periodPct(current);
  const avgBefore = periodPct(previous);
  const chartData = current.map((d) => ({
    label: range === 7 ? weekdayShort(d.date) : formatDate(d.date).slice(0, -5),
    pct: d.pct,
    detail: `${d.attended}/${d.total} on ${formatDate(d.date)}`,
  }));

  // Fees (admins only)
  const collectedIn = (m: string) => monthPayments.filter((p) => p.paidOn.startsWith(m)).reduce((s, p) => s + p.amount, 0);
  const collected = collectedIn(month);
  const lastMonth = collectedIn(addMonths(month, -1));

  // Branch attendance (30 days)
  const branchRows = branches.map((b) => {
    const recs = branchAtt.filter((r) => r.student.branchId === b.id);
    return { ...b, players: students.filter((s) => s.branchId === b.id).length, pct: percent(recs.filter((r) => attended(r.status)).length, recs.length) };
  });

  // Recently added players
  const recent = [...students].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);
  const recentAtt = await attendanceByStudent(recent.map((s) => s.id), since30);

  // Today's schedule
  const todays = batches.filter((b) => b.days.split(',').includes(weekday));

  const addButton = options.branches.length > 0 && (
    <FormModal title="Add new student" eyebrow="PLAYER ENROLLMENT" description="Create a student record in your academy." trigger={<><Plus size={17} /> Add student</>} action={createStudent} submitLabel="Create student">
      <StudentFields options={options} />
    </FormModal>
  );

  return (
    <>
      {searchParams.denied && (
        <div className="section-banner">
          <div className="banner-icon"><ShieldAlert size={20} /></div>
          <div><b>Administrator access needed</b><p>The page you opened is only available to administrators.</p></div>
        </div>
      )}
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        subtitle="Here’s what’s happening at your academy today."
        actions={<>
          {isAdmin && <Link className="secondary-btn" href="/reports"><Activity size={16} /> Reports</Link>}
          {addButton}
        </>}
      />

      <div className="stats-grid">
        <StatCard title="Active players" value={String(students.length)} trend={newThisMonth ? { text: `+${newThisMonth}`, direction: 'up' } : null} detail={newThisMonth ? 'joined this month' : 'no new joins this month'} icon={<Users size={17} />} color="red" spark={playerSpark} />
        <StatCard
          title="Attendance today"
          value={todayStat.pct === null ? '—' : `${todayStat.pct}%`}
          trend={diffTrend(todayStat.pct, yesterday.pct, ' pts')}
          detail={todayStat.total ? `${todayStat.attended} of ${todayStat.total} marked present` : 'not marked yet'}
          icon={<ClipboardCheck size={17} />}
          color="green"
          spark={dayStats.slice(-8).map((d) => d.pct ?? 0)}
        />
        {isAdmin ? (
          <StatCard title="Fees collected" value={inrCompact(collected)} detail={`this month · last month ${inrCompact(lastMonth)}`} icon={<CircleDollarSign size={17} />} color="blue" spark={lastNMonths(8).map(collectedIn)} />
        ) : (
          <StatCard title="Sessions today" value={String(todays.length)} detail={`scheduled for ${weekday}`} icon={<CalendarDays size={17} />} color="blue" />
        )}
        <StatCard title="Active batches" value={String(batches.length)} detail={`${todays.length} training today`} icon={<Dumbbell size={17} />} color="amber" />
      </div>

      <div className="dashboard-grid">
        <article className="panel attendance-panel">
          <div className="panel-head">
            <div><h3>Attendance overview</h3><p>Academy-wide attendance trend</p></div>
            <div className="seg-links">
              <Link href="/?range=7" className={range === 7 ? 'on' : ''}>7 days</Link>
              <Link href="/?range=30" className={range === 30 ? 'on' : ''}>30 days</Link>
            </div>
          </div>
          {current.every((d) => d.total === 0) ? (
            <Empty title="No attendance marked in this period" action={<Link className="text-btn" href="/attendance">Mark attendance <ArrowRight size={14} /></Link>} />
          ) : (
            <>
              <div className="chart-summary">
                <div>
                  <strong>{avgNow ?? '—'}<span>%</span></strong>
                  {avgNow !== null && avgBefore !== null && <span className="chart-trend"><TrendInline trend={diffTrend(avgNow, avgBefore, ' pts')} /></span>}
                  <small>Average attendance, last {range} days{avgBefore !== null ? ` (previous ${range} days: ${avgBefore}%)` : ''}</small>
                </div>
                <div className="chart-legend"><span /><small>Attendance</small></div>
              </div>
              <div className="chart"><AttendanceChart data={chartData} target={ATTENDANCE_TARGET} /></div>
              <div className="chart-foot"><span><i className="foot-dot" />Attendance rate</span><span>Target <b>{ATTENDANCE_TARGET}%</b></span></div>
            </>
          )}
        </article>

        <article className="panel branch-panel">
          <div className="panel-head"><div><h3>Branch performance</h3><p>Attendance by location, last 30 days</p></div></div>
          {branchRows.length === 0 ? <Empty title="No branches yet" /> : (
            <div className="branch-list">
              {branchRows.map((b, i) => (
                <div key={b.id} className="branch-item">
                  <div className="branch-meta"><div><b>{b.name}</b><small>{b.players} players</small></div><strong>{b.pct === null ? '—' : `${b.pct}%`}</strong></div>
                  <div className="progress"><span className={['red', 'white', 'gray'][i % 3]} style={{ width: `${b.pct ?? 0}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          {isAdmin && <div className="branch-total"><span>{branchRows.length} {branchRows.length === 1 ? 'branch' : 'branches'}</span><Link href="/branches">View branches <ArrowRight size={14} /></Link></div>}
        </article>
      </div>

      <div className="lower-grid">
        <Panel title="Player directory" subtitle="Recently added players" action={<Link className="text-btn" href="/students">View all <ArrowRight size={14} /></Link>}>
          {recent.length === 0 ? <Empty title="No students yet" action={addButton}>Add your first student to get started.</Empty> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>PLAYER</th><th>BATCH</th><th>ATTENDANCE</th><th>STATUS</th></tr></thead>
                  <tbody>
                    {recent.map((s) => (
                      <tr key={s.id}>
                        <td><Link href={`/students/${s.id}`} className="player-cell"><Avatar name={s.name} photo={photoUrl(s)} /><div><b>{s.name}</b><small>{s.ageGroup}{s.playingRole ? ` · ${s.playingRole}` : ''}</small></div></Link></td>
                        <td>{s.batch ? <span className="batch-tag">{s.batch.name}</span> : <small className="muted">Not assigned</small>}</td>
                        <td><AttendanceBar pct={recentAtt.get(s.id) ?? null} /></td>
                        <td><StatusPill status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-bottom"><span>Showing <b>{recent.length}</b> of <b>{students.length}</b> active players</span><Link href="/students">Open player directory <ArrowRight size={14} /></Link></div>
            </>
          )}
        </Panel>

        <Panel title="Today’s schedule" subtitle={formatDate(today)}>
          {todays.length === 0 ? <Empty title={`No batches scheduled on ${weekday}`} /> : (
            <div className="schedule-list">
              {todays.map((b, i) => (
                <Link key={b.id} href={`/attendance?batch=${b.id}`} className="schedule-item">
                  <div className="schedule-time">{formatTime(b.startTime)}</div>
                  <div className={`schedule-marker ${['', 'orange', 'blue'][i % 3]}`} />
                  <div className="schedule-info"><b>{b.name}</b><small>{b.coach ? `Coach ${b.coach.name}` : 'No coach'}{b.venue ? ` · ${b.venue}` : ''} · {b._count.students} players</small></div>
                  <span className="age-tag">{b.ageGroup}</span>
                </Link>
              ))}
            </div>
          )}
          <Link className="schedule-cta" href="/batches">View all batches <ArrowRight size={15} /></Link>
        </Panel>
      </div>
    </>
  );
}

function TrendInline({ trend }: { trend: Trend }) {
  if (!trend) return null;
  return <span className={`trend ${trend.direction === 'up' ? 'positive' : trend.direction === 'down' ? 'negative' : 'neutral'}`}>{trend.text}</span>;
}
