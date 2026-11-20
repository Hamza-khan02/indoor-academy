'use client';

import { useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import type { ActionResult } from '@/lib/form';
import { useToast } from '@/components/Toast';

export type ScoreRow = {
  studentId: string; name: string; bat: 'DNB' | 'OUT' | 'NOT_OUT';
  runs: string; balls: string; fours: string; sixes: string;
  overs: string; maidens: string; runsConceded: string; wickets: string;
  catches: string; stumpings: string; runOuts: string;
};

const NUMBER_FIELDS: [keyof ScoreRow, string, string][] = [
  ['runs', 'R', 'Runs'], ['balls', 'B', 'Balls faced'], ['fours', '4s', 'Fours'], ['sixes', '6s', 'Sixes'],
];
const BOWLING_FIELDS: [keyof ScoreRow, string, string][] = [
  ['overs', 'O', 'Overs (e.g. 3.4)'], ['maidens', 'M', 'Maidens'], ['runsConceded', 'R', 'Runs conceded'], ['wickets', 'W', 'Wickets'],
];
const FIELDING_FIELDS: [keyof ScoreRow, string, string][] = [
  ['catches', 'Ct', 'Catches'], ['stumpings', 'St', 'Stumpings'], ['runOuts', 'RO', 'Run outs'],
];

const blank = (studentId: string, name: string): ScoreRow => ({
  studentId, name, bat: 'DNB', runs: '', balls: '', fours: '', sixes: '', overs: '', maidens: '', runsConceded: '', wickets: '', catches: '', stumpings: '', runOuts: '',
});

/** Table for entering every player's batting, bowling and fielding in one match. */
export function ScorecardEditor({
  initial,
  players,
  squad,
  action,
}: {
  initial: ScoreRow[];
  players: { id: string; name: string; ageGroup: string }[];
  squad: { id: string; name: string }[];
  action: (fd: FormData) => Promise<ActionResult>;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<ScoreRow[]>(initial);
  const [pick, setPick] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inCard = new Set(rows.map((r) => r.studentId));
  const available = players.filter((p) => !inCard.has(p.id));
  const update = (i: number, key: keyof ScoreRow, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value, ...(key !== 'bat' && NUMBER_FIELDS.some(([k]) => k === key) && value && r.bat === 'DNB' ? { bat: 'OUT' } : {}) } : r)));

  function addPlayer() {
    const p = players.find((x) => x.id === pick);
    if (p) setRows((rs) => [...rs, blank(p.id, p.name)]);
    setPick('');
  }
  function addSquad() {
    setRows((rs) => [...rs, ...squad.filter((s) => !inCard.has(s.id)).map((s) => blank(s.id, s.name))]);
  }

  async function save() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set('rows', JSON.stringify(rows.map(({ name, ...r }) => r)));
    try {
      const r = await action(fd);
      if (r.ok) toast(r.message ?? 'Saved');
      else setError(r.error ?? 'Could not save.');
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setPending(false);
  }

  const input = (i: number, key: keyof ScoreRow, short: string, title: string, wide = false) => (
    <input
      className={`score-input ${wide ? 'wide' : ''}`}
      inputMode={key === 'overs' ? 'decimal' : 'numeric'}
      value={rows[i][key]}
      onChange={(e) => update(i, key, e.target.value.replace(key === 'overs' ? /[^\d.]/g : /\D/g, ''))}
      placeholder={short}
      aria-label={`${rows[i].name}: ${title}`}
      title={title}
    />
  );

  return (
    <div className="scorecard">
      <div className="sheet-toolbar">
        <div className="add-player">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add player">
            <option value="">Add a player…</option>
            {available.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.ageGroup})</option>)}
          </select>
          <button type="button" className="secondary-btn" onClick={addPlayer} disabled={!pick}><Plus size={14} /> Add</button>
          {squad.some((s) => !inCard.has(s.id)) && (
            <button type="button" className="secondary-btn" onClick={addSquad}><Plus size={14} /> Add tournament squad</button>
          )}
        </div>
        <span className="muted">{rows.length} players</span>
      </div>

      {rows.length === 0 ? (
        <p className="muted small-note">Add the players who played this match.</p>
      ) : (
        <div className="table-wrap">
          <table className="score-table">
            <thead>
              <tr>
                <th rowSpan={2}>PLAYER</th>
                <th colSpan={5} className="grp">BATTING</th>
                <th colSpan={4} className="grp">BOWLING</th>
                <th colSpan={3} className="grp">FIELDING</th>
                <th rowSpan={2} />
              </tr>
              <tr>
                <th>How</th>{NUMBER_FIELDS.map(([k, s, t]) => <th key={k} title={t}>{s}</th>)}
                {BOWLING_FIELDS.map(([k, s, t]) => <th key={k} title={t}>{s}</th>)}
                {FIELDING_FIELDS.map(([k, s, t]) => <th key={k} title={t}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.studentId}>
                  <td><b>{r.name}</b></td>
                  <td>
                    <select className="score-input bat" value={r.bat} onChange={(e) => update(i, 'bat', e.target.value)} aria-label={`${r.name}: batting`}>
                      <option value="DNB">Did not bat</option>
                      <option value="OUT">Out</option>
                      <option value="NOT_OUT">Not out</option>
                    </select>
                  </td>
                  {NUMBER_FIELDS.map(([k, s, t]) => <td key={k}>{input(i, k, s, t)}</td>)}
                  {BOWLING_FIELDS.map(([k, s, t]) => <td key={k}>{input(i, k, s, t, k === 'overs')}</td>)}
                  {FIELDING_FIELDS.map(([k, s, t]) => <td key={k}>{input(i, k, s, t)}</td>)}
                  <td><button type="button" className="icon-action danger" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${r.name}`}><X size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="form-hint">Overs like <b>3.4</b> mean 3 overs and 4 balls. Leave boxes empty for 0.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sheet-save">
        <button type="button" className="primary-btn" onClick={save} disabled={pending}><Save size={15} /> {pending ? 'Saving…' : 'Save scorecard'}</button>
      </div>
    </div>
  );
}
