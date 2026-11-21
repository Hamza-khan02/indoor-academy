// Full career page body, shared by the staff app and the parent app.
import Link from 'next/link';
import { Award, FileText, Medal, Shield, Target } from 'lucide-react';
import type { Career } from '@/lib/career';
import { SCORE_WEIGHTS } from '@/lib/career-calc';
import { formatDate } from '@/lib/dates';
import { Avatar, Empty, Panel } from '@/components/ui';
import { MatchTrendChart, RatingTrendChart } from './CareerCharts';

const show = (v: number | string | null | undefined) => (v === null || v === undefined ? '—' : String(v));
const RANK_LABEL = { runs: 'Runs', wickets: 'Wickets', average: 'Batting average', catches: 'Catches & stumpings' } as const;
const MILESTONE_ICON = { bat: Target, bowl: Shield, field: Award, start: Medal } as const;

function StatsTable({ rows, firstHeader }: { rows: (Career['seasons'][number] & { label?: string })[]; firstHeader: string }) {
  return (
    <div className="table-wrap">
      <table className="stats-table">
        <thead>
          <tr><th>{firstHeader}</th><th>M</th><th>Inns</th><th>Runs</th><th>HS</th><th>Avg</th><th>SR</th><th>50s</th><th>Wkts</th><th>Best</th><th>Econ</th><th>Ct</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td><b>{r.label ?? r.key}</b></td>
              <td>{r.matches}</td><td>{r.innings}</td><td><b>{r.runs}</b></td><td>{r.highest}</td>
              <td>{r.average === null && r.innings ? `${r.runs}*` : show(r.average)}</td><td>{show(r.strikeRate)}</td>
              <td>{r.fifties + r.hundreds}</td><td><b>{r.wickets}</b></td><td>{r.bestBowling}</td><td>{show(r.economy)}</td><td>{r.catches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CareerView({ data, cardHref }: { data: Career; cardHref: string }) {
  const { student, career: c, score } = data;
  const parts = [
    { key: 'rating', label: 'Coach rating', note: data.latestRating ? `latest ${formatDate(data.latestRating.date)}` : 'no assessment yet' },
    { key: 'attendance', label: 'Attendance', note: data.attendance.sessions ? `${data.attendance.sessions} sessions in 90 days` : 'no attendance in 90 days' },
    { key: 'matches', label: 'Match performance', note: c.matches ? `${c.matches} matches` : 'no matches yet' },
  ] as const;

  return (
    <>
      <section className="career-hero panel padded">
        <Avatar name={student.name} photo={student.photo} />
        <div className="career-hero-copy">
          <span className="eyebrow">CAREER STATS</span>
          <h1>{student.name}</h1>
          <p>{student.ageGroup}{student.playingRole ? ` · ${student.playingRole}` : ''}{student.batchName ? ` · ${student.batchName}` : ''} · {student.branchName} · joined {formatDate(student.joinedOn)}</p>
        </div>
        <div className="score-badge" title="Overall performance score">
          <b>{show(score.score)}</b><span>/100</span>
        </div>
        <Link className="secondary-btn" href={cardHref} target="_blank"><FileText size={15} /> Career card</Link>
      </section>

      <div className="career-strip">
        {[
          ['Matches', c.matches], ['Runs', c.runs], ['Highest', c.highest], ['Average', c.average === null && c.innings ? `${c.runs}*` : show(c.average)],
          ['Strike rate', show(c.strikeRate)], ['Wickets', c.wickets], ['Best bowling', c.bestBowling], ['Economy', show(c.economy)], ['Catches', c.catches],
        ].map(([label, value]) => <div key={label as string}><small>{label}</small><b>{value}</b></div>)}
      </div>

      <div className="two-col">
        <Panel title="Overall performance score" subtitle="Out of 100 — a guide, not a selection decision">
          {score.score === null ? <Empty title="Not enough data yet">The score appears once there is a coach rating, attendance or a match.</Empty> : (
            <ul className="score-parts">
              {parts.map((p) => {
                const v = score.parts[p.key];
                return (
                  <li key={p.key} className={v === null ? 'missing' : ''}>
                    <div className="score-part-head"><span>{p.label} <small className="muted">· {SCORE_WEIGHTS[p.key]}% weight · {p.note}</small></span><b>{show(v)}</b></div>
                    <div className="progress"><span className="red" style={{ width: `${v ?? 0}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="form-hint score-help">
            Coach rating = latest assessment average × 10. Attendance = sessions attended in the last 90 days.
            Match performance = (runs + 20 per wicket + 10 per catch/stumping/run out) per match × 2, up to 100.
            Parts without data are left out and the others count for more.
          </p>
        </Panel>

        <Panel title="Rank in batch" subtitle={`Among ${data.rankGroup} with match records`}>
          <ul className="rank-tiles">
            {data.ranks.map((r) => (
              <li key={r.metric}>
                <small>{RANK_LABEL[r.metric]}</small>
                {r.rank ? <b>#{r.rank} <span>of {r.of}</span></b> : <b className="muted">—</b>}
                <span className="muted">{r.rank ? show(r.value) : r.metric === 'average' ? 'needs 3 innings' : 'no matches yet'}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="two-col">
        <Panel title="Runs & wickets by match" subtitle="Oldest to newest">
          {data.charts.perMatch.length === 0 ? <Empty title="No matches yet" /> : <div className="chart tall"><MatchTrendChart data={data.charts.perMatch} /></div>}
        </Panel>
        <Panel title="Coach rating over time" subtitle="Scores out of 10">
          {data.charts.ratings.length === 0 ? <Empty title="No assessments yet" /> : <div className="chart tall"><RatingTrendChart data={data.charts.ratings} /></div>}
        </Panel>
      </div>

      <Panel title="Season by season" subtitle="Season = April to March" className="spaced-bottom">
        {data.seasons.length === 0 ? <Empty title="No matches yet" /> : <StatsTable rows={data.seasons} firstHeader="SEASON" />}
      </Panel>

      <div className="two-col">
        <Panel title="By match type">
          {data.types.length === 0 ? <Empty title="No matches yet" /> : <StatsTable rows={data.types} firstHeader="TYPE" />}
        </Panel>
        <Panel title="Milestones" subtitle="Newest first">
          {data.milestones.length === 0 ? <Empty title="No milestones yet">They appear as matches are recorded.</Empty> : (
            <ul className="milestones">
              {data.milestones.map((m, i) => {
                const Icon = MILESTONE_ICON[m.kind];
                return (
                  <li key={i} className={`m-${m.kind}`}>
                    <span className="m-icon"><Icon size={14} /></span>
                    <div className="stack"><b>{m.title}</b><small className="muted">{m.detail} · {formatDate(m.date)}</small></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
