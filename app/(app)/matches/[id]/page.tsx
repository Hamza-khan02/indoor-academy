import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { MATCH_RESULTS, MATCH_TYPES } from '@/lib/constants';
import { oversText } from '@/lib/cricket';
import { formatDate } from '@/lib/dates';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Panel } from '@/components/ui';
import { MatchFields } from '../MatchFields';
import { ScorecardEditor, type ScoreRow } from '../ScorecardEditor';
import { deleteMatch, saveScorecard, updateMatch } from '../actions';

const str = (n: number) => (n ? String(n) : '');

export default async function MatchPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requireUser();
  const match = await db.match.findUnique({
    where: { id: params.id },
    include: {
      tournament: { select: { id: true, name: true, squad: { select: { student: { select: { id: true, name: true } } } } } },
      stats: { include: { student: { select: { name: true } } } },
    },
  });
  if (!match) notFound();
  const [players, tournaments] = await Promise.all([
    db.student.findMany({ where: { status: { not: 'INACTIVE' } }, orderBy: { name: 'asc' }, select: { id: true, name: true, ageGroup: true } }),
    db.tournament.findMany({ orderBy: { startDate: 'desc' }, select: { id: true, name: true } }),
  ]);

  const rows: ScoreRow[] = match.stats
    .sort((a, b) => a.student.name.localeCompare(b.student.name))
    .map((s) => ({
      studentId: s.studentId,
      name: s.student.name,
      bat: s.batted ? (s.notOut ? 'NOT_OUT' : 'OUT') : 'DNB',
      runs: str(s.runs), balls: str(s.balls), fours: str(s.fours), sixes: str(s.sixes),
      overs: s.ballsBowled ? oversText(s.ballsBowled) : '', maidens: str(s.maidens), runsConceded: str(s.runsConceded), wickets: str(s.wickets),
      catches: str(s.catches), stumpings: str(s.stumpings), runOuts: str(s.runOuts),
    }));

  const topBat = [...match.stats].filter((s) => s.batted).sort((a, b) => b.runs - a.runs)[0];
  const topBowl = [...match.stats].filter((s) => s.ballsBowled).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];

  return (
    <>
      <Link href="/matches" className="back-link"><ArrowLeft size={14} /> All matches</Link>
      <div className="match-head panel padded">
        <div>
          <span className="eyebrow">{formatDate(match.date).toUpperCase()} · {(MATCH_TYPES[match.matchType] ?? match.matchType).toUpperCase()}{match.overs ? ` · ${match.overs} OVERS` : ''}</span>
          <h1>vs {match.opponent}</h1>
          <p className="muted">
            {match.venue ?? 'Venue not set'}
            {match.tournament && <> · <Link href={`/tournaments/${match.tournament.id}`} className="text-btn inline">{match.tournament.name}</Link></>}
          </p>
          {(match.ourScore || match.opponentScore) && <p className="match-score">Academy <b>{match.ourScore ?? '—'}</b> · {match.opponent} <b>{match.opponentScore ?? '—'}</b></p>}
          {match.notes && <p className="card-note">{match.notes}</p>}
        </div>
        <div className="match-side">
          {match.result && <span className={`result-tag big r-${match.result.toLowerCase()}`}>{MATCH_RESULTS[match.result]}</span>}
          <div className="row-actions">
            <FormModal title={`Edit match vs ${match.opponent}`} trigger={<><Pencil size={14} /> Edit</>} triggerClassName="secondary-btn" action={updateMatch.bind(null, match.id)}>
              <MatchFields tournaments={tournaments} match={match} />
            </FormModal>
            {user.role === 'ADMIN' && (
              <ConfirmAction action={deleteMatch.bind(null, match.id)} redirectTo="/matches" className="secondary-btn danger" confirmText={`Delete the match vs ${match.opponent} and its whole scorecard?`}>
                <Trash2 size={14} /> Delete
              </ConfirmAction>
            )}
          </div>
        </div>
      </div>

      {(topBat || topBowl) && (
        <div className="match-highlights">
          {topBat && <div><small>TOP SCORER</small><b>{topBat.student.name}</b><span>{topBat.runs}{topBat.notOut ? '*' : ''} ({topBat.balls})</span></div>}
          {topBowl && <div><small>BEST BOWLING</small><b>{topBowl.student.name}</b><span>{topBowl.wickets}/{topBowl.runsConceded} ({oversText(topBowl.ballsBowled)})</span></div>}
        </div>
      )}

      <Panel title="Scorecard" subtitle="Our players only. Saving updates every player's career stats.">
        <ScorecardEditor
          initial={rows}
          players={players}
          squad={match.tournament?.squad.map((s) => s.student) ?? []}
          action={saveScorecard.bind(null, match.id)}
        />
      </Panel>
    </>
  );
}
