// One-page printable career card (light theme), used by staff and parents.
import type { Career } from '@/lib/career';
import { formatDate, todayISO } from '@/lib/dates';
import { avatarClass, initials } from '@/lib/format';

const show = (v: number | string | null | undefined) => (v === null || v === undefined ? '—' : String(v));

export function CareerCard({ data, academyName }: { data: Career; academyName: string }) {
  const { student, career: c, score } = data;
  const stats: [string, string | number][] = [
    ['Matches', c.matches], ['Runs', c.runs], ['Highest', c.highest],
    ['Average', c.average === null && c.innings ? `${c.runs}*` : show(c.average)], ['Strike rate', show(c.strikeRate)], ['50s / 100s', `${c.fifties} / ${c.hundreds}`],
    ['Wickets', c.wickets], ['Best bowling', c.bestBowling], ['Economy', show(c.economy)],
    ['Catches', c.catches], ['Stumpings', c.stumpings], ['Run outs', c.runOuts],
  ];

  return (
    <article className="career-card">
      <header className="cc-head">
        <div>
          <small>{academyName.toUpperCase()}</small>
          <h1>Player career card</h1>
        </div>
        <div className="cc-score"><b>{show(score.score)}</b><span>/100 overall</span></div>
      </header>

      <section className="cc-player">
        <div className={`cc-photo ${student.photo ? '' : avatarClass(student.name)}`}>
          {student.photo ? <img src={student.photo} alt="" /> : initials(student.name)}
        </div>
        <div>
          <h2>{student.name}</h2>
          <p>{student.ageGroup}{student.playingRole ? ` · ${student.playingRole}` : ''}</p>
          <p>{student.batchName ? `${student.batchName} · ` : ''}{student.branchName}</p>
          <p className="cc-muted">At the academy since {formatDate(student.joinedOn)}</p>
        </div>
      </section>

      <section className="cc-stats">
        {stats.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}
      </section>

      {data.seasons.length > 0 && (
        <section>
          <h3>Season by season</h3>
          <table className="cc-table">
            <thead><tr><th>Season</th><th>M</th><th>Runs</th><th>HS</th><th>Avg</th><th>SR</th><th>Wkts</th><th>Best</th><th>Econ</th></tr></thead>
            <tbody>
              {data.seasons.slice(0, 4).map((s) => (
                <tr key={s.key}>
                  <td>{s.key}</td><td>{s.matches}</td><td>{s.runs}</td><td>{s.highest}</td>
                  <td>{s.average === null && s.innings ? `${s.runs}*` : show(s.average)}</td><td>{show(s.strikeRate)}</td>
                  <td>{s.wickets}</td><td>{s.bestBowling}</td><td>{show(s.economy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="cc-two">
        <section>
          <h3>Milestones</h3>
          {data.milestones.length === 0 ? <p className="cc-muted">No milestones yet.</p> : (
            <ul className="cc-list">
              {data.milestones.slice(0, 7).map((m, i) => <li key={i}><b>{m.title}</b> — {m.detail} <span className="cc-muted">({formatDate(m.date)})</span></li>)}
            </ul>
          )}
        </section>
        <section>
          <h3>Coach rating & attendance</h3>
          <ul className="cc-list">
            {data.latestRating ? (
              <li>
                <b>Latest rating ({formatDate(data.latestRating.date)}):</b> Batting {data.latestRating.batting}, Bowling {data.latestRating.bowling},
                Fielding {data.latestRating.fielding}, Fitness {data.latestRating.fitness} (out of 10)
              </li>
            ) : <li className="cc-muted">No coach rating yet.</li>}
            <li><b>Attendance (90 days):</b> {data.attendance.pct === null ? 'not recorded' : `${data.attendance.pct}%`}</li>
            {data.ranks.filter((r) => r.rank).map((r) => (
              <li key={r.metric}><b>Rank in {data.rankGroup} ({r.metric === 'catches' ? 'catches' : r.metric}):</b> #{r.rank} of {r.of}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="cc-foot">Generated from {academyName} records on {formatDate(todayISO())}.</footer>
    </article>
  );
}
