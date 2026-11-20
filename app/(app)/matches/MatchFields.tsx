import { MATCH_RESULTS, MATCH_TYPES } from '@/lib/constants';
import { todayISO } from '@/lib/dates';

type Match = {
  date: string; opponent: string; venue: string | null; matchType: string; overs: number | null; result: string | null;
  ourScore: string | null; opponentScore: string | null; notes: string | null; tournamentId: string | null;
};

/** Fields for adding or editing a match. */
export function MatchFields({ tournaments, match }: { tournaments: { id: string; name: string }[]; match?: Match }) {
  return (
    <>
      <div className="form-row">
        <label>Opponent *<input name="opponent" required maxLength={80} defaultValue={match?.opponent} placeholder="e.g. Lucknow Cricket Club" /></label>
        <label>Date *<input name="date" type="date" required max={todayISO()} defaultValue={match?.date ?? todayISO()} /></label>
      </div>
      <div className="form-row">
        <label>Match type *
          <select name="matchType" defaultValue={match?.matchType ?? 'FRIENDLY'}>
            {Object.entries(MATCH_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Tournament
          <select name="tournamentId" defaultValue={match?.tournamentId ?? ''}>
            <option value="">None</option>
            {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>Venue<input name="venue" maxLength={80} defaultValue={match?.venue ?? ''} /></label>
        <label>Overs per side<input name="overs" type="number" min={1} max={50} defaultValue={match?.overs ?? ''} placeholder="e.g. 20" /></label>
      </div>
      <div className="form-row">
        <label>Our score<input name="ourScore" maxLength={30} defaultValue={match?.ourScore ?? ''} placeholder="e.g. 145/6 (20)" /></label>
        <label>Opponent score<input name="opponentScore" maxLength={30} defaultValue={match?.opponentScore ?? ''} placeholder="e.g. 132/9 (20)" /></label>
      </div>
      <label>Result
        <select name="result" defaultValue={match?.result ?? ''}>
          <option value="">Not entered</option>
          {Object.entries(MATCH_RESULTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Notes<textarea name="notes" rows={2} maxLength={500} defaultValue={match?.notes ?? ''} placeholder="Player of the match, highlights…" /></label>
    </>
  );
}
