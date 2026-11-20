import Link from 'next/link';
import { CalendarDays, Clock3, FileText, MapPin, Trophy, UserRound } from 'lucide-react';
import { db } from '@/lib/db';
import { requireFamily } from '@/lib/family';
import { ATTENDANCE_STATUS, DAYS, PAYMENT_METHODS, SQUAD_ROLES, TOURNAMENT_STATUS } from '@/lib/constants';
import { MatchRecord } from '@/components/MatchRecord';
import { addDays, currentMonth, formatDate, formatLongDate, formatTime, monthLabel, todayISO, weekdayShort } from '@/lib/dates';
import { inr, percent } from '@/lib/format';
import { attended } from '@/lib/queries';
import { AttendanceBar, Empty, Panel, StatusPill } from '@/components/ui';
import { PhotoEditor } from '@/components/PhotoEditor';
import { photoUrl } from '@/lib/photos';
import { removeChildPhoto, uploadChildPhoto } from '@/lib/photo-actions';

const SKILLS = [['batting', 'Batting'], ['bowling', 'Bowling'], ['fielding', 'Fielding'], ['fitness', 'Fitness']] as const;
type Scores = { batting: number; bowling: number; fielding: number; fitness: number };
const average = (a: Scores) => (a.batting + a.bowling + a.fielding + a.fitness) / 4;

function nextSession(days: string[], today: string) {
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    if (days.includes(weekdayShort(d))) return { date: d, inDays: i };
  }
  return null;
}

export default async function ParentHome({ searchParams }: { searchParams: { child?: string } }) {
  const family = await requireFamily();
  if (family.students.length === 0) {
    return (
      <article className="panel padded">
        <Empty title="No students linked to this phone number">
          Your login works, but no student record has this guardian phone number right now. Please contact the academy.
        </Empty>
      </article>
    );
  }

  // Only the family's own children can be opened.
  const childId = family.students.find((s) => s.id === searchParams.child)?.id ?? family.students[0].id;
  const today = todayISO();
  const month = currentMonth();
  const since30 = addDays(today, -29);

  const student = await db.student.findUniqueOrThrow({
    where: { id: childId },
    include: {
      batch: { include: { coach: { select: { name: true } } } },
      branch: { select: { name: true } },
      attendance: { orderBy: { date: 'desc' }, take: 60, select: { id: true, date: true, status: true } },
      payments: { orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }], select: { id: true, amount: true, forMonth: true, paidOn: true, receiptNo: true, method: true } },
      assessments: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 20 },
      matchStats: { include: { match: { select: { date: true, opponent: true, result: true } } } },
      squads: {
        where: { tournament: { status: { in: ['UPCOMING', 'ONGOING'] } } },
        include: { tournament: { select: { id: true, name: true, startDate: true } } },
      },
    },
  });
  const tournaments = await db.tournament.findMany({
    where: {
      status: { in: ['UPCOMING', 'ONGOING'] },
      OR: [{ ageGroup: null }, { ageGroup: student.ageGroup }, { squad: { some: { studentId: student.id } } }],
    },
    orderBy: { startDate: 'asc' },
    take: 10,
  });
  const selectedRole = new Map(student.squads.map((s) => [s.tournamentId, s.role]));

  const batchDays = student.batch?.days.split(',') ?? [];
  const next = student.batch?.active ? nextSession(batchDays, today) : null;
  const recent = student.attendance.filter((a) => a.date >= since30);
  const count = (status: string) => recent.filter((a) => a.status === status).length;
  const pct30 = percent(recent.filter((a) => attended(a.status)).length, recent.length);
  const fee = student.batch?.monthlyFee ?? 0;
  const paidThisMonth = student.payments.filter((p) => p.forMonth === month).reduce((t, p) => t + p.amount, 0);
  const due = Math.max(0, fee - paidThisMonth);
  const latest = student.assessments[0];
  const inactive = student.status === 'INACTIVE';

  return (
    <>
      {family.students.length > 1 && (
        <nav className="child-tabs" aria-label="Choose child">
          {family.students.map((s) => (
            <Link key={s.id} href={`/parent?child=${s.id}`} className={s.id === childId ? 'on' : ''}>{s.name}</Link>
          ))}
        </nav>
      )}

      <section className="portal-hero panel padded">
        <PhotoEditor
          name={student.name}
          photo={photoUrl(student)}
          upload={uploadChildPhoto.bind(null, student.id)}
          remove={removeChildPhoto.bind(null, student.id)}
        />
        <div className="portal-hero-copy">
          <h1>{student.name}</h1>
          <p>{student.ageGroup}{student.playingRole ? ` · ${student.playingRole}` : ''} · {student.batch?.name ?? 'No batch yet'} · {student.branch.name}</p>
        </div>
        {inactive && <StatusPill status="INACTIVE" labels={{ INACTIVE: 'Not currently enrolled' }} />}
      </section>

      {student.squads.map((s) => (
        <div key={s.tournamentId} className="selected-banner">
          <Trophy size={20} />
          <div>
            <b>{student.name.split(' ')[0]} has been selected for {s.tournament.name}!</b>
            <span>{s.role !== 'PLAYER' ? `${SQUAD_ROLES[s.role]} · ` : ''}Starts {formatDate(s.tournament.startDate)}</span>
          </div>
        </div>
      ))}

      <div className="portal-grid">
        <Panel title="Training schedule" subtitle={student.batch ? `${student.batch.name} · ${student.batch.ageGroup}` : undefined}>
          {!student.batch ? <Empty title="Not assigned to a batch yet" /> : (
            <>
              {next && (
                <div className="next-session">
                  <CalendarDays size={18} />
                  <div>
                    <small>NEXT SESSION</small>
                    <b>{next.inDays === 0 ? 'Today' : next.inDays === 1 ? 'Tomorrow' : formatLongDate(next.date)}, {formatTime(student.batch.startTime)}</b>
                  </div>
                </div>
              )}
              <div className="day-row">
                {DAYS.map((d) => <span key={d} className={`${batchDays.includes(d) ? 'on' : ''} ${d === weekdayShort(today) ? 'today' : ''}`}>{d.slice(0, 2)}</span>)}
              </div>
              <ul className="meta-list">
                <li><Clock3 size={14} /> {formatTime(student.batch.startTime)} – {formatTime(student.batch.endTime)}</li>
                <li><MapPin size={14} /> {student.batch.venue ? `${student.batch.venue}, ` : ''}{student.branch.name}</li>
                <li><UserRound size={14} /> {student.batch.coach ? `Coach ${student.batch.coach.name}` : 'Coach not assigned yet'}</li>
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Attendance" subtitle="Last 30 days" action={<AttendanceBar pct={pct30} />}>
          {student.attendance.length === 0 ? <Empty title="No attendance marked yet" /> : (
            <>
              <div className="mini-stats">
                <div><strong className="c-present">{count('PRESENT')}</strong><small>Present</small></div>
                <div><strong className="c-late">{count('LATE')}</strong><small>Late</small></div>
                <div><strong className="c-absent">{count('ABSENT')}</strong><small>Absent</small></div>
              </div>
              <div className="att-history">
                {student.attendance.slice(0, 30).map((a) => (
                  <span key={a.id} className={`att-chip ${a.status.toLowerCase()}`} title={`${formatDate(a.date)}: ${ATTENDANCE_STATUS[a.status]}`}>
                    {a.date.slice(8)}/{a.date.slice(5, 7)}
                  </span>
                ))}
              </div>
              <p className="legend"><span className="c-present">■ Present</span> <span className="c-late">■ Late</span> <span className="c-absent">■ Absent</span></p>
            </>
          )}
        </Panel>

        <Panel title="Fees" subtitle={fee ? `Monthly fee ${inr(fee)}` : 'No monthly fee set'}>
          {fee > 0 && !inactive && (
            <div className={`fee-status ${due > 0 ? 'due' : 'paid'}`}>
              <small>{monthLabel(month).toUpperCase()}</small>
              <b>{due > 0 ? `${inr(due)} due` : 'Paid in full ✓'}</b>
              {due > 0 && paidThisMonth > 0 && <span>{inr(paidThisMonth)} received so far</span>}
            </div>
          )}
          {student.payments.length === 0 ? <Empty title="No payments yet" /> : (
            <ul className="payment-list">
              {student.payments.slice(0, 12).map((p) => (
                <li key={p.id}>
                  <div className="stack">
                    <b>{monthLabel(p.forMonth)}</b>
                    <small className="muted">Paid {formatDate(p.paidOn)} · {PAYMENT_METHODS[p.method] ?? p.method}</small>
                  </div>
                  <strong>{inr(p.amount)}</strong>
                  <Link className="wa-btn receipt-link" href={`/parent/receipt/${p.id}`}><FileText size={14} /> Receipt</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Coach ratings" subtitle="Scores out of 10, with the coach's notes">
          {!latest ? <Empty title="No assessments yet">The coach's ratings will appear here after the first assessment.</Empty> : (
            <>
              <div className="rating-head">
                <div><small>LATEST · {formatDate(latest.date)}</small><b>{average(latest).toFixed(1)}<span>/10</span></b></div>
                {latest.coachName && <span className="muted">by {latest.coachName}</span>}
              </div>
              <ul className="skill-bars">
                {SKILLS.map(([key, label]) => (
                  <li key={key}>
                    <span>{label}</span>
                    <div className="progress"><span className="red" style={{ width: `${latest[key] * 10}%` }} /></div>
                    <b>{latest[key]}</b>
                  </li>
                ))}
              </ul>
              {latest.notes && <p className="coach-note">“{latest.notes}”</p>}
              {student.assessments.length > 1 && (
                <details className="history">
                  <summary>Earlier assessments ({student.assessments.length - 1})</summary>
                  <ul>
                    {student.assessments.slice(1).map((a) => (
                      <li key={a.id}>
                        <div className="history-row"><b>{formatDate(a.date)}</b><span>Avg {average(a).toFixed(1)} · Bat {a.batting} · Bowl {a.bowling} · Field {a.fielding} · Fit {a.fitness}</span></div>
                        {a.notes && <p className="muted">“{a.notes}”{a.coachName ? ` — ${a.coachName}` : ''}</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </Panel>

        <Panel title="Match record" subtitle="Career stats from the academy's match scorecards" className="portal-wide">
          <MatchRecord rows={student.matchStats} />
        </Panel>

        <Panel title="Health & emergency" subtitle="To change these details, please contact the academy">
          <dl className="details">
            <dt>Blood group</dt><dd>{student.bloodGroup ?? <span className="muted">Not known</span>}</dd>
            <dt>Emergency</dt>
            <dd>{student.emergencyName || student.emergencyPhone ? `${student.emergencyName ?? 'Contact'}${student.emergencyPhone ? ` · ${student.emergencyPhone}` : ''}` : <span className="muted">Not added</span>}</dd>
            <dt>Medical</dt><dd>{student.medicalNotes ?? <span className="muted">Nothing noted</span>}</dd>
          </dl>
        </Panel>

        <Panel title="Upcoming tournaments" subtitle={`For ${student.ageGroup} and open events`}>
          {tournaments.length === 0 ? <Empty title="No upcoming tournaments right now" /> : (
            <ul className="tournament-list">
              {tournaments.map((t) => (
                <li key={t.id}>
                  <Trophy size={16} />
                  <div className="stack">
                    <b>{t.name}</b>
                    <small className="muted">
                      {formatDate(t.startDate)}{t.endDate && t.endDate !== t.startDate ? ` – ${formatDate(t.endDate)}` : ''}
                      {t.venue ? ` · ${t.venue}` : ''}{t.ageGroup ? ` · ${t.ageGroup}` : ''}
                    </small>
                  </div>
                  {selectedRole.has(t.id) && <span className="selected-tag">✓ Selected{selectedRole.get(t.id) !== 'PLAYER' ? ` · ${SQUAD_ROLES[selectedRole.get(t.id)!]}` : ''}</span>}
                  <StatusPill status={t.status} labels={TOURNAMENT_STATUS} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
