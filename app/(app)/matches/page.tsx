import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { MATCH_RESULTS, MATCH_TYPES } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Empty, PageHeader } from '@/components/ui';
import { MatchFields } from './MatchFields';
import { createMatch, deleteMatch, updateMatch } from './actions';

export default async function MatchesPage() {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const [matches, tournaments] = await Promise.all([
    db.match.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { tournament: { select: { name: true } }, _count: { select: { stats: true } } },
    }),
    db.tournament.findMany({ orderBy: { startDate: 'desc' }, select: { id: true, name: true } }),
  ]);
  const won = matches.filter((m) => m.result === 'WON').length;
  const lost = matches.filter((m) => m.result === 'LOST').length;

  const addButton = (
    <FormModal title="Add match" eyebrow="MATCHES" trigger={<><Plus size={17} /> Add match</>} action={createMatch} submitLabel="Add match">
      <MatchFields tournaments={tournaments} />
    </FormModal>
  );

  return (
    <>
      <PageHeader
        title="Matches"
        subtitle={matches.length ? `${matches.length} matches · ${won} won · ${lost} lost. Open a match to enter each player's runs, wickets and catches.` : 'Record matches and player scorecards to build every player’s career stats.'}
        actions={addButton}
      />
      <article className="panel padded">
        {matches.length === 0 ? (
          <Empty title="No matches yet" action={addButton}>Add a match, then fill in its scorecard. Career stats appear on each student’s profile and in the parent app.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>DATE</th><th>OPPONENT</th><th>TYPE</th><th>SCORE</th><th>RESULT</th><th>SCORECARD</th><th /></tr></thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.date)}</td>
                    <td><Link href={`/matches/${m.id}`} className="player-cell"><div><b>vs {m.opponent}</b><small>{m.venue ?? ''}</small></div></Link></td>
                    <td>{MATCH_TYPES[m.matchType] ?? m.matchType}{m.tournament && <small className="muted block">{m.tournament.name}</small>}</td>
                    <td>{m.ourScore || m.opponentScore ? <>{m.ourScore ?? '—'} <span className="muted">v</span> {m.opponentScore ?? '—'}</> : <span className="muted">—</span>}</td>
                    <td>{m.result ? <span className={`result-tag r-${m.result.toLowerCase()}`}>{MATCH_RESULTS[m.result]}</span> : <span className="muted">—</span>}</td>
                    <td><Link className="text-btn" href={`/matches/${m.id}`}>{m._count.stats ? `${m._count.stats} players` : 'Fill in'}</Link></td>
                    <td>
                      <div className="row-actions">
                        <FormModal title={`Edit match vs ${m.opponent}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={updateMatch.bind(null, m.id)}>
                          <MatchFields tournaments={tournaments} match={m} />
                        </FormModal>
                        {isAdmin && (
                          <ConfirmAction action={deleteMatch.bind(null, m.id)} confirmText={`Delete the match vs ${m.opponent} and its whole scorecard?`} label="Delete"><Trash2 size={15} /></ConfirmAction>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}
