import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { photoUrl } from '@/lib/photos';
import { requireUser } from '@/lib/auth';
import { LOW_ATTENDANCE } from '@/lib/constants';
import { addDays, formatDate, todayISO } from '@/lib/dates';
import { attendanceByStudent } from '@/lib/queries';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { AttendanceBar, Avatar, Empty, PageHeader, Panel } from '@/components/ui';
import { AssessmentFields } from './AssessmentFields';
import { addAssessment, deleteAssessment } from './actions';

const avg = (a: { batting: number; bowling: number; fielding: number; fitness: number }) => (a.batting + a.bowling + a.fielding + a.fitness) / 4;

export default async function PerformancePage() {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const students = await db.student.findMany({
    where: { status: { not: 'INACTIVE' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, ageGroup: true, status: true, photoUpdatedAt: true, batch: { select: { name: true } } },
  });
  const [assessments, attendance] = await Promise.all([
    db.assessment.findMany({
      where: { student: { status: { not: 'INACTIVE' } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 300,
      include: { student: { select: { name: true, photoUpdatedAt: true } } },
    }),
    attendanceByStudent(students.map((s) => s.id), addDays(todayISO(), -29)),
  ]);

  // Latest assessment per student.
  const latest = new Map<string, (typeof assessments)[number]>();
  for (const a of assessments) if (!latest.has(a.studentId)) latest.set(a.studentId, a);
  const topRated = [...latest.values()].sort((a, b) => avg(b) - avg(a)).slice(0, 5);

  const withAtt = students.map((s) => ({ ...s, pct: attendance.get(s.id) ?? null }));
  const leaders = withAtt.filter((s) => s.pct !== null).sort((a, b) => b.pct! - a.pct!).slice(0, 5);
  const attention = withAtt.filter((s) => s.status === 'REVIEW' || (s.pct !== null && s.pct < LOW_ATTENDANCE));

  // Match leaders (all recorded matches, current students only).
  const activeWhere = { student: { status: { not: 'INACTIVE' } } };
  const [runAgg, wicketAgg] = await Promise.all([
    db.playerMatchStat.groupBy({ by: ['studentId'], where: activeWhere, _sum: { runs: true }, _count: { _all: true }, orderBy: { _sum: { runs: 'desc' } }, take: 5 }),
    db.playerMatchStat.groupBy({ by: ['studentId'], where: activeWhere, _sum: { wickets: true }, _count: { _all: true }, orderBy: { _sum: { wickets: 'desc' } }, take: 5 }),
  ]);
  const byId = new Map(students.map((s) => [s.id, s]));
  const topRuns = runAgg.filter((r) => (r._sum.runs ?? 0) > 0 && byId.has(r.studentId));
  const topWickets = wicketAgg.filter((r) => (r._sum.wickets ?? 0) > 0 && byId.has(r.studentId));

  const addButton = students.length > 0 && (
    <FormModal title="New assessment" eyebrow="PERFORMANCE" trigger={<><Plus size={17} /> New assessment</>} action={addAssessment} submitLabel="Save assessment">
      <AssessmentFields students={students} />
    </FormModal>
  );

  return (
    <>
      <PageHeader title="Performance" subtitle="Coach assessments and attendance trends for the last 30 days." actions={addButton} />
      {students.length === 0 ? (
        <article className="panel padded"><Empty title="No students yet">Add students to start tracking performance.</Empty></article>
      ) : (
        <>
          <div className="three-col">
            <Panel title="Top rated" subtitle="Latest assessment average">
              {topRated.length === 0 ? <Empty title="No assessments yet" /> : (
                <ol className="rank-list">
                  {topRated.map((a) => (
                    <li key={a.id}><Link href={`/students/${a.studentId}`}><Avatar name={a.student.name} small photo={photoUrl({ id: a.studentId, photoUpdatedAt: a.student.photoUpdatedAt })} /><span>{a.student.name}</span><b>{avg(a).toFixed(1)}</b></Link></li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Attendance leaders" subtitle="Highest attendance">
              {leaders.length === 0 ? <Empty title="No attendance marked yet" /> : (
                <ol className="rank-list">
                  {leaders.map((s) => (
                    <li key={s.id}><Link href={`/students/${s.id}`}><Avatar name={s.name} small photo={photoUrl(s)} /><span>{s.name}</span><b>{s.pct}%</b></Link></li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Needs attention" subtitle={`Under ${LOW_ATTENDANCE}% attendance or marked for review`}>
              {attention.length === 0 ? <Empty title="Nobody flagged" /> : (
                <ul className="rank-list">
                  {attention.slice(0, 8).map((s) => (
                    <li key={s.id}><Link href={`/students/${s.id}`}><Avatar name={s.name} small photo={photoUrl(s)} /><span>{s.name}</span><AttendanceBar pct={s.pct} /></Link></li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="two-col spaced-top">
            <Panel title="Top run scorers" subtitle="All recorded matches" action={<Link className="text-btn" href="/matches">Matches</Link>}>
              {topRuns.length === 0 ? <Empty title="No match runs yet" /> : (
                <ol className="rank-list">
                  {topRuns.map((r) => {
                    const s = byId.get(r.studentId)!;
                    return <li key={r.studentId}><Link href={`/students/${s.id}`}><Avatar name={s.name} small photo={photoUrl(s)} /><span>{s.name} <small className="muted">{r._count._all} matches</small></span><b>{r._sum.runs}</b></Link></li>;
                  })}
                </ol>
              )}
            </Panel>
            <Panel title="Top wicket takers" subtitle="All recorded matches">
              {topWickets.length === 0 ? <Empty title="No match wickets yet" /> : (
                <ol className="rank-list">
                  {topWickets.map((r) => {
                    const s = byId.get(r.studentId)!;
                    return <li key={r.studentId}><Link href={`/students/${s.id}`}><Avatar name={s.name} small photo={photoUrl(s)} /><span>{s.name} <small className="muted">{r._count._all} matches</small></span><b>{r._sum.wickets}</b></Link></li>;
                  })}
                </ol>
              )}
            </Panel>
          </div>

          <Panel title="Recent assessments" subtitle="Ratings out of 10" className="spaced-top">
            {assessments.length === 0 ? <Empty title="No assessments yet" action={addButton}>Coaches can rate batting, bowling, fielding and fitness after sessions.</Empty> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>PLAYER</th><th>DATE</th><th>BAT</th><th>BOWL</th><th>FIELD</th><th>FIT</th><th>AVG</th><th>COACH</th><th>NOTES</th>{isAdmin && <th />}</tr></thead>
                  <tbody>
                    {assessments.slice(0, 30).map((a) => (
                      <tr key={a.id}>
                        <td><Link href={`/students/${a.studentId}`} className="player-cell"><Avatar name={a.student.name} small photo={photoUrl({ id: a.studentId, photoUpdatedAt: a.student.photoUpdatedAt })} /><b>{a.student.name}</b></Link></td>
                        <td>{formatDate(a.date)}</td>
                        <td>{a.batting}</td><td>{a.bowling}</td><td>{a.fielding}</td><td>{a.fitness}</td>
                        <td><b>{avg(a).toFixed(1)}</b></td>
                        <td>{a.coachName ?? '—'}</td>
                        <td className="wrap">{a.notes ?? '—'}</td>
                        {isAdmin && <td><ConfirmAction action={deleteAssessment.bind(null, a.id)} confirmText="Delete this assessment?" label="Delete"><Trash2 size={14} /></ConfirmAction></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
