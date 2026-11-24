'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import type { ActionResult } from '@/lib/form';

/** A plain form that runs a server action and shows its result: used for login, register and profile forms. */
export function ActionForm({ action, submitLabel, pendingLabel = 'Please wait…', next, children }: {
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  pendingLabel?: string;
  /** Where to go after success. Without it the form stays and shows the success message. */
  next?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNote(null);
    setPending(true);
    try {
      const result = await action(new FormData(e.currentTarget));
      if (result.ok && next) {
        router.replace(next);
        router.refresh();
        return;
      }
      setNote({ ok: result.ok, text: (result.ok ? result.message : result.error) ?? '' });
      if (result.ok) router.refresh();
    } catch {
      setNote({ ok: false, text: 'Could not reach the server. Please try again.' });
    }
    setPending(false);
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {children}
      {note && <p className={note.ok ? 'rn-note good' : 'form-error'} role={note.ok ? 'status' : 'alert'} style={{ marginBottom: 14 }}>{note.text}</p>}
      <button className="primary-btn login-btn" disabled={pending}>{pending ? pendingLabel : <>{submitLabel} <ArrowRight size={15} /></>}</button>
    </form>
  );
}
