import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { MATCH_RESULTS, TOURNAMENT_STATUS } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { Empty, Panel, StatusPill } from '@/components/ui';
import { SquadEditor } from '../SquadEditor';
import { saveSquad } from '../actions';

export default async function TournamentPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireUser();
  const t = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      squad: { select: { studentId: true, role: true } },
      matches: { orderBy: { date: 'desc' }, select: { id: true, date: true, opponent: true, result: true, ourScore: true, opponentScore: true } },
    },
  });
  if (!t) notFound();
  const squadIds = t.squad.map((s) => s.studentId);
  const students = await db.student.findMany({
    where: { OR: [{ status: { not: 'INACTIVE' } }, { id: { in: squadIds } }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, ageGroup: true, playingRole: true },
  });

  return (
    <>
      <Link href="/tournaments" className="back-link"><ArrowLeft size={14} /> All tournaments</Link>
      <div className="match-head panel padded">
        <div>
          <span className="eyebrow">TOURNAMENT{t.ageGroup ? ` · ${t.ageGroup}` : ''}</span>
          <h1>{t.name}</h1>
          <ul className="meta-list inline">
            <li><CalendarDays size={14} /> {formatDate(t.startDate)}{t.endDate && t.endDate !== t.startDate ? ` – ${formatDate(t.endDate)}` : ''}</li>
            <li><MapPin size={14} /> {t.venue ?? 'Venue not set'}</li>
          </ul>
          {t.result && <p className="card-note">{t.result}</p>}
        </div>
        <div className="match-side"><StatusPill status={t.status} labels={TOURNAMENT_STATUS} /></div>
      </div>

      <div className="two-col wide-left">
        <Panel title="Squad" subtitle="Selected players see “Selected” for this tournament in the parent app.">
          <SquadEditor
            students={students}
            initial={Object.fromEntries(t.squad.map((s) => [s.studentId, s.role]))}
            ageGroup={t.ageGroup}
            action={saveSquad.bind(null, t.id)}
          />
        </Panel>
        <Panel title="Matches in this tournament" subtitle="Add them from Matches and choose this tournament">
          {t.matches.length === 0 ? <Empty title="No matches yet" action={<Link className="text-btn" href="/matches">Go to Matches</Link>} /> : (
            <ul className="recent-matches">
              {t.matches.map((m) => (
                <li key={m.id}>
                  <span className="muted">{formatDate(m.date)}</span>
                  <Link href={`/matches/${m.id}`} className="text-btn inline">vs {m.opponent}</Link>
                  {m.result && <span className={`result-tag r-${m.result.toLowerCase()}`}>{MATCH_RESULTS[m.result]}</span>}
                  {(m.ourScore || m.opponentScore) && <span className="line">{m.ourScore ?? '—'} v {m.opponentScore ?? '—'}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
