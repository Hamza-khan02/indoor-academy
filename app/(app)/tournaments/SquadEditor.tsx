'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { SQUAD_ROLES } from '@/lib/constants';
import type { ActionResult } from '@/lib/form';
import { useToast } from '@/components/Toast';

type Student = { id: string; name: string; ageGroup: string; playingRole: string | null };

/** Pick the tournament squad: tick players and give each a role. */
export function SquadEditor({
  students,
  initial,
  ageGroup,
  action,
}: {
  students: Student[];
  initial: Record<string, string>;
  ageGroup: string | null;
  action: (fd: FormData) => Promise<ActionResult>;
}) {
  const toast = useToast();
  const [squad, setSquad] = useState<Record<string, string>>(initial);
  const [showAll, setShowAll] = useState(!ageGroup);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = students.filter((s) => showAll || s.ageGroup === ageGroup || squad[s.id]);
  const count = Object.keys(squad).length;

  function toggle(id: string) {
    setSquad((sq) => {
      const next = { ...sq };
      if (next[id]) delete next[id];
      else next[id] = 'PLAYER';
      return next;
    });
  }

  async function save() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set('squad', JSON.stringify(Object.entries(squad).map(([studentId, role]) => ({ studentId, role }))));
    try {
      const r = await action(fd);
      if (r.ok) toast(r.message ?? 'Saved');
      else setError(r.error ?? 'Could not save.');
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setPending(false);
  }

  return (
    <div>
      <div className="sheet-toolbar">
        <span><b>{count}</b> selected</span>
        {ageGroup && (
          <label className="inline-check">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all age groups (not only {ageGroup})
          </label>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="muted small-note">No active students in {ageGroup}. Tick “Show all age groups” to pick from everyone.</p>
      ) : (
        <ul className="sheet squad-list">
          {visible.map((s) => (
            <li key={s.id} className={squad[s.id] ? 'picked' : ''}>
              <label className="squad-pick">
                <input type="checkbox" checked={!!squad[s.id]} onChange={() => toggle(s.id)} />
                <span className="stack"><b>{s.name}</b><small className="muted">{s.ageGroup}{s.playingRole ? ` · ${s.playingRole}` : ''}</small></span>
              </label>
              {squad[s.id] && (
                <select value={squad[s.id]} onChange={(e) => setSquad((sq) => ({ ...sq, [s.id]: e.target.value }))} aria-label={`${s.name}: role`}>
                  {Object.entries(SQUAD_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sheet-save">
        <button type="button" className="primary-btn" onClick={save} disabled={pending}><Save size={15} /> {pending ? 'Saving…' : 'Save squad'}</button>
      </div>
    </div>
  );
}
