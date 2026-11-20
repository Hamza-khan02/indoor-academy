'use client';

import { useState } from 'react';
import { AlertTriangle, Copy, KeyRound, MessageCircle, X } from 'lucide-react';
import { issueParentPin, type PinResult } from '@/lib/family-actions';
import { useToast } from './Toast';

/**
 * Creates (or replaces) the parent app PIN for a student's guardian phone and shows it once,
 * with a ready WhatsApp message containing the login link, phone and PIN.
 */
export function ParentAccessButton({ studentId, hasLogin, className = 'secondary-btn' }: { studentId: string; hasLogin: boolean; className?: string }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PinResult | null>(null);

  async function onClick() {
    if (hasLogin && !window.confirm('Create a new PIN? The old PIN will stop working and the family will be logged out of the parent app.')) return;
    setPending(true);
    try {
      const r = await issueParentPin(studentId);
      if (r.ok) setResult(r);
      else toast(r.error ?? 'Something went wrong.', 'error');
    } catch {
      toast('Could not reach the server. Please try again.', 'error');
    }
    setPending(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result?.text ?? '');
      toast('Message copied');
    } catch {
      toast('Could not copy. Select the text and copy it manually.', 'error');
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={onClick} disabled={pending}>
        <KeyRound size={14} /> {pending ? 'Creating…' : hasLogin ? 'New PIN' : 'Give parent access'}
      </button>
      {result && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setResult(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Parent app PIN">
            <div className="modal-head">
              <div><span className="eyebrow">PARENT APP</span><h2>{result.message}</h2></div>
              <button type="button" className="icon-button" onClick={() => setResult(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="pin-box">
              <div><small>PHONE</small><b>{result.phone}</b></div>
              <div><small>PIN</small><b className="pin">{result.pin}</b></div>
            </div>
            <p className="form-hint">This PIN is shown only once. Send it to the parent now; if it is lost, create a new PIN.</p>
            {result.localOnly && (
              <p className="form-error warn">
                <AlertTriangle size={14} /> The login link ({result.loginUrl}) only works on this computer because the app isn&apos;t online yet.
                After hosting, set the app&apos;s address in Settings → Parent app and create the PIN again.
              </p>
            )}
            <div className="preview-box"><small>Message</small>{result.text}</div>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={copy}><Copy size={14} /> Copy message</button>
              {result.waUrl && (
                <a className="wa-btn big" href={result.waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Send on WhatsApp</a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
