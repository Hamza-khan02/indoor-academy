'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { MESSAGE_PRESETS, PLACEHOLDERS, type MessageSettings, fillTemplate } from '@/lib/messages';
import { updateMessageSettings } from '@/lib/reminder-actions';
import { useToast } from '@/components/Toast';

const SAMPLE = { parent: 'Mr. Verma', student: 'Ananya Verma', batch: 'Elite Juniors', amount: '₹ 2,500', month: 'Nov 2026', date: '20 Nov 2026' };

/** Admin editor for the academy name and WhatsApp message templates, with a live preview. */
export function MessageTemplates({ initial }: { initial: MessageSettings }) {
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof MessageSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const preview = (template: string) => fillTemplate(template, { ...SAMPLE, academy: values.academyName || 'Academy' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await updateMessageSettings(new FormData(e.currentTarget));
      if (r.ok) toast(r.message);
      else setError(r.error);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setPending(false);
  }

  return (
    <form className="form template-editor" onSubmit={onSubmit}>
      <div className="preset-row">
        <span className="muted">Start from:</span>
        {Object.entries(MESSAGE_PRESETS).map(([key, p]) => (
          <button key={key} type="button" className="secondary-btn" onClick={() => setValues((v) => ({ ...v, feeTemplate: p.fee, absentTemplate: p.absent }))}>
            {p.label}
          </button>
        ))}
      </div>
      <label>Academy name (used as {'{academy}'})<input name="academyName" maxLength={60} required value={values.academyName} onChange={set('academyName')} /></label>
      <label>Fee reminder message<textarea name="feeTemplate" rows={4} maxLength={1000} required value={values.feeTemplate} onChange={set('feeTemplate')} /></label>
      <div className="preview-box"><small>Preview</small>{preview(values.feeTemplate)}</div>
      <label>Absence message<textarea name="absentTemplate" rows={4} maxLength={1000} required value={values.absentTemplate} onChange={set('absentTemplate')} /></label>
      <div className="preview-box"><small>Preview</small>{preview(values.absentTemplate)}</div>
      <details className="placeholder-help">
        <summary>Words you can use in messages</summary>
        <ul>{Object.entries(PLACEHOLDERS).map(([k, v]) => <li key={k}><code>{k}</code> {v}</li>)}</ul>
      </details>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sheet-save">
        <button className="primary-btn" disabled={pending}><Save size={15} /> {pending ? 'Saving…' : 'Save messages'}</button>
      </div>
    </form>
  );
}
