// A player's career summary and recent matches. Used on the staff profile and in the parent app.
import Link from 'next/link';
import { MATCH_RESULTS } from '@/lib/constants';
import { careerStats, matchLine, type StatRow } from '@/lib/cricket';
import { formatDate } from '@/lib/dates';
import { Empty } from './ui';

type Row = StatRow & { id: string; matchId: string; match: { date: string; opponent: string; result: string | null } };

const show = (v: number | string | null) => (v === null ? '—' : String(v));

export function MatchRecord({ rows, linkMatches = false }: { rows: Row[]; linkMatches?: boolean }) {
  if (rows.length === 0) return <Empty title="No matches recorded yet">Runs, wickets and catches appear here once a match scorecard is filled in.</Empty>;
  const c = careerStats(rows);
  const recent = [...rows].sort((a, b) => b.match.date.localeCompare(a.match.date)).slice(0, 6);

  return (
    <>
      <div className="career">
        <section>
          <h4>Batting</h4>
          <dl>
            <div><dt>Matches</dt><dd>{c.matches}</dd></div>
            <div><dt>Runs</dt><dd>{c.runs}</dd></div>
            <div><dt>Highest</dt><dd>{c.highest}</dd></div>
            <div><dt>Average</dt><dd>{c.average === null && c.innings ? `${c.runs}*` : show(c.average)}</dd></div>
            <div><dt>Strike rate</dt><dd>{show(c.strikeRate)}</dd></div>
            <div><dt>50s / 100s</dt><dd>{c.fifties} / {c.hundreds}</dd></div>
            <div><dt>4s / 6s</dt><dd>{c.fours} / {c.sixes}</dd></div>
          </dl>
        </section>
        <section>
          <h4>Bowling</h4>
          <dl>
            <div><dt>Overs</dt><dd>{c.overs}</dd></div>
            <div><dt>Wickets</dt><dd>{c.wickets}</dd></div>
            <div><dt>Best</dt><dd>{c.bestBowling}</dd></div>
            <div><dt>Economy</dt><dd>{show(c.economy)}</dd></div>
            <div><dt>Average</dt><dd>{show(c.bowlingAverage)}</dd></div>
          </dl>
        </section>
        <section>
          <h4>Fielding</h4>
          <dl>
            <div><dt>Catches</dt><dd>{c.catches}</dd></div>
            <div><dt>Stumpings</dt><dd>{c.stumpings}</dd></div>
            <div><dt>Run outs</dt><dd>{c.runOuts}</dd></div>
          </dl>
        </section>
      </div>
      <h4 className="recent-title">Recent matches</h4>
      <ul className="recent-matches">
        {recent.map((r) => (
          <li key={r.id}>
            <span className="muted">{formatDate(r.match.date)}</span>
            {linkMatches ? <Link href={`/matches/${r.matchId}`} className="text-btn inline">vs {r.match.opponent}</Link> : <b>vs {r.match.opponent}</b>}
            {r.match.result && <span className={`result-tag r-${r.match.result.toLowerCase()}`}>{MATCH_RESULTS[r.match.result]}</span>}
            <span className="line">{matchLine(r)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
