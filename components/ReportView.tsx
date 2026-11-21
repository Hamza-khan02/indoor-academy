// Printable monthly progress report (light theme), shared by staff and the parent app.
import { ATTENDANCE_STATUS, MATCH_RESULTS, SQUAD_ROLES } from '@/lib/constants';
import { DRILL_CATEGORIES } from '@/lib/drills';
import { formatDate, todayISO } from '@/lib/dates';
import { avatarClass, initials, inr } from '@/lib/format';
import type { MonthlyReport } from '@/lib/report';

const SKILLS = [['batting', 'Batting'], ['bowling', 'Bowling'], ['fielding', 'Fielding'], ['fitness', 'Fitness']] as const;

function Change({ now, before, suffix = '' }: { now: number | null; before: number | null; suffix?: string }) {
  if (now === null || before === null) return null;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return <span className="rp-chg flat">= same</span>;
  return <span className={`rp-chg ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{suffix}</span>;
}

export function ReportView({ r, academyName }: { r: MonthlyReport; academyName: string }) {
  const s = r.student;
  const a = r.attendance;
  const m = r.matches.totals;
  return (
    <article className="report">
      <header className="rp-head">
        <div>
          <small>{academyName.toUpperCase()}</small>
          <h1>Monthly progress report</h1>
        </div>
        <div className="rp-month">{r.monthLabel}</div>
      </header>

      <section className="rp-player">
        <div className={`cc-photo ${s.photo ? '' : avatarClass(s.name)}`}>{s.photo ? <img src={s.photo} alt="" /> : initials(s.name)}</div>
        <div>
          <h2>{s.name}</h2>
          <p>{s.ageGroup}{s.playingRole ? ` · ${s.playingRole}` : ''}</p>
          <p>{s.batchName ? `${s.batchName} · ` : ''}{s.branchName}{s.coachName ? ` · Coach ${s.coachName}` : ''}</p>
        </div>
      </section>

      <section className="rp-tiles">
        <div><small>Attendance</small><b>{a.pct === null ? '—' : `${a.pct}%`}</b><Change now={a.pct} before={a.prevPct} suffix=" pts" /></div>
        <div><small>Coach rating</small><b>{r.rating ? `${r.rating.average}/10` : '—'}</b><Change now={r.rating?.average ?? null} before={r.rating?.previousAverage ?? null} /></div>
        <div><small>Matches</small><b>{m.matches}</b><span className="rp-sub">{m.matches ? `${m.runs} runs · ${m.wickets} wkts` : 'none this month'}</span></div>
        <div><small>Drills done</small><b>{r.drills.total ? `${r.drills.done}/${r.drills.total}` : '—'}</b><span className="rp-sub">{r.drills.total ? '' : 'none set'}</span></div>
      </section>

      <div className="rp-two">
        <section>
          <h3>Attendance</h3>
          {a.total === 0 ? <p className="cc-muted">No sessions marked this month.</p> : (
            <>
              <p>{a.present} present · {a.late} late · {a.absent} absent — {a.total} sessions{a.prevPct !== null ? ` (last month ${a.prevPct}%)` : ''}</p>
              <div className="rp-days">
                {a.days.map((d) => <span key={d.date} className={`rp-day ${d.status.toLowerCase()}`} title={`${formatDate(d.date)}: ${ATTENDANCE_STATUS[d.status]}`}>{Number(d.date.slice(8))}</span>)}
              </div>
            </>
          )}
        </section>
        <section>
          <h3>Coach rating</h3>
          {!r.rating ? <p className="cc-muted">Not assessed yet.</p> : (
            <>
              <p className="cc-muted">{r.rating.inMonth ? `Assessed ${formatDate(r.rating.date)}` : `No new assessment this month — latest from ${formatDate(r.rating.date)}`}{r.rating.coachName ? ` by ${r.rating.coachName}` : ''}</p>
              <ul className="rp-skills">
                {SKILLS.map(([k, label]) => (
                  <li key={k}>
                    <span>{label}</span>
                    <div className="rp-bar"><i style={{ width: `${r.rating!.scores[k] * 10}%` }} /></div>
                    <b>{r.rating!.scores[k]}</b>
                    <Change now={r.rating!.scores[k]} before={r.rating!.previous?.[k] ?? null} />
                  </li>
                ))}
              </ul>
              {r.rating.notes && <p className="rp-quote">“{r.rating.notes}”</p>}
            </>
          )}
        </section>
      </div>

      <div className="rp-two">
        <section>
          <h3>Matches</h3>
          {r.matches.list.length === 0 ? <p className="cc-muted">No matches this month.</p> : (
            <ul className="cc-list">
              {r.matches.list.map((x, i) => (
                <li key={i}><b>vs {x.opponent}</b> <span className="cc-muted">({formatDate(x.date)}{x.result ? `, ${MATCH_RESULTS[x.result]}` : ''})</span> — {x.line}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>Practice drills</h3>
          {r.drills.list.length === 0 ? <p className="cc-muted">No drills set this month.</p> : (
            <ul className="cc-list rp-drills">
              {r.drills.list.map((d, i) => (
                <li key={i}>{d.done ? '✅' : '⬜'} {(DRILL_CATEGORIES[d.category] ?? DRILL_CATEGORIES.OTHER).emoji} {d.title}{d.note ? <span className="cc-muted"> — “{d.note}”</span> : null}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(r.selections.length > 0 || r.fee.fee > 0) && (
        <div className="rp-two">
          {r.selections.length > 0 && (
            <section>
              <h3>Selections</h3>
              <ul className="cc-list">{r.selections.map((x, i) => <li key={i}>🏆 <b>{x.name}</b>{x.role !== 'PLAYER' ? ` (${SQUAD_ROLES[x.role]})` : ''} — starts {formatDate(x.startDate)}</li>)}</ul>
            </section>
          )}
          {r.fee.fee > 0 && (
            <section>
              <h3>Fee for {r.monthLabel}</h3>
              <p>{r.fee.due ? <><b className="rp-due">{inr(r.fee.due)} due</b> (paid {inr(r.fee.paid)} of {inr(r.fee.fee)})</> : <b className="rp-paid">Paid in full ✓</b>}</p>
            </section>
          )}
        </div>
      )}

      <section className="rp-comment">
        <h3>Coach&apos;s comment</h3>
        {r.comment ? <p>{r.comment.text}{r.comment.author ? <span className="cc-muted"> — {r.comment.author}</span> : null}</p> : <p className="cc-muted">No comment added for this month.</p>}
      </section>

      <footer className="cc-foot">Generated from {academyName} records on {formatDate(todayISO())}.</footer>
    </article>
  );
}
