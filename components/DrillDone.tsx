'use client';

import { useState } from 'react';
import { CheckCircle2, Undo2 } from 'lucide-react';
import type { ActionResult } from '@/lib/form';

/** Parent app: "Mark as done" (with an optional note) or "Undo" for one drill. */
export function DrillDone({
  done,
  doneLabel,
  markDone,
  undo,
}: {
  done: boolean;
  doneLabel: string;
  markDone: (fd: FormData) => Promise<ActionResult>;
  undo: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(fn: () => Promise<ActionResult>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ text: r.ok ? r.message ?? 'Saved' : r.error ?? 'Could not save.', ok: r.ok });
      if (r.ok) setOpen(false);
    } catch {
      setMsg({ text: 'Could not reach the server. Please try again.', ok: false });
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="drill-done">
        <span className="c-present"><CheckCircle2 size={14} /> {doneLabel}</span>
        <button type="button" className="text-btn subtle" disabled={busy} onClick={() => run(undo)}><Undo2 size={12} /> Undo</button>
        {msg && <small className={msg.ok ? 'c-present' : 'c-absent'}>{msg.text}</small>}
      </div>
    );
  }
  return (
    <div className="drill-done">
      {!open ? (
        <button type="button" className="wa-btn" onClick={() => setOpen(true)}><CheckCircle2 size={14} /> Mark as done</button>
      ) : (
        <form
          className="drill-done-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.set('note', note);
            run(() => markDone(fd));
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note for the coach (optional)" aria-label="Note for the coach" />
          <button className="primary-btn" disabled={busy}>{busy ? 'Saving…' : 'Done ✓'}</button>
          <button type="button" className="text-btn subtle" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      )}
      {msg && <small className={msg.ok ? 'c-present' : 'c-absent'}>{msg.text}</small>}
    </div>
  );
}
