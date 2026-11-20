import Link from 'next/link';
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { AGE_GROUPS, TOURNAMENT_STATUS } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Empty, PageHeader, StatusPill } from '@/components/ui';
import { createTournament, deleteTournament, updateTournament } from './actions';

type Tournament = { name: string; startDate: string; endDate: string | null; venue: string | null; ageGroup: string | null; status: string; result: string | null };

function TournamentFields({ t }: { t?: Tournament }) {
  return (
    <>
      <label>Tournament name *<input name="name" required maxLength={100} defaultValue={t?.name} placeholder="e.g. District U-14 Cup" /></label>
      <div className="form-row">
        <label>Start date *<input name="startDate" type="date" required defaultValue={t?.startDate} /></label>
        <label>End date<input name="endDate" type="date" defaultValue={t?.endDate ?? ''} /></label>
      </div>
      <div className="form-row">
        <label>Venue<input name="venue" maxLength={100} defaultValue={t?.venue ?? ''} /></label>
        <label>Age group
          <select name="ageGroup" defaultValue={t?.ageGroup ?? ''}>
            <option value="">Any</option>
            {AGE_GROUPS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <label>Status *
        <select name="status" defaultValue={t?.status ?? 'UPCOMING'}>
          {Object.entries(TOURNAMENT_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Result / notes<textarea name="result" rows={3} maxLength={500} defaultValue={t?.result ?? ''} placeholder="Squad, fixtures, final result…" /></label>
    </>
  );
}

export default async function TournamentsPage() {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const tournaments = await db.tournament.findMany({ orderBy: { startDate: 'desc' }, include: { _count: { select: { squad: true, matches: true } } } });
  const order = ['ONGOING', 'UPCOMING', 'COMPLETED'];
  const groups = order.map((status) => ({
    status,
    items: tournaments.filter((t) => t.status === status).sort((a, b) => (status === 'COMPLETED' ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate))),
  }));

  const addButton = (
    <FormModal title="Add tournament" eyebrow="TOURNAMENTS" trigger={<><Plus size={17} /> Add tournament</>} action={createTournament} submitLabel="Add tournament">
      <TournamentFields />
    </FormModal>
  );

  return (
    <>
      <PageHeader title="Tournaments" subtitle="Matches and competitions the academy takes part in." actions={addButton} />
      {tournaments.length === 0 ? (
        <article className="panel padded"><Empty title="No tournaments yet" action={addButton}>Track upcoming tournaments, venues and results.</Empty></article>
      ) : (
        groups.filter((g) => g.items.length).map((g) => (
          <section key={g.status} className="group">
            <h2 className="group-title">{TOURNAMENT_STATUS[g.status]} <span>{g.items.length}</span></h2>
            <div className="card-grid">
              {g.items.map((t) => (
                <article key={t.id} className="panel padded">
                  <div className="panel-head">
                    <div><h3><Link href={`/tournaments/${t.id}`}>{t.name}</Link></h3>{t.ageGroup && <p>{t.ageGroup}</p>}</div>
                    <StatusPill status={t.status} labels={TOURNAMENT_STATUS} />
                  </div>
                  <ul className="meta-list">
                    <li><CalendarDays size={14} /> {formatDate(t.startDate)}{t.endDate && t.endDate !== t.startDate ? ` – ${formatDate(t.endDate)}` : ''}</li>
                    <li><MapPin size={14} /> {t.venue ?? 'Venue not set'}</li>
                  </ul>
                  {t.result && <p className="card-note">{t.result}</p>}
                  <div className="row-actions end">
                    <Link className="text-btn squad-link" href={`/tournaments/${t.id}`}>Squad ({t._count.squad}){t._count.matches ? ` · ${t._count.matches} matches` : ""}</Link>
                    <FormModal title={`Edit ${t.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={updateTournament.bind(null, t.id)}>
                      <TournamentFields t={t} />
                    </FormModal>
                    {isAdmin && <ConfirmAction action={deleteTournament.bind(null, t.id)} confirmText={`Delete ${t.name}?`} label="Delete"><Trash2 size={15} /></ConfirmAction>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
