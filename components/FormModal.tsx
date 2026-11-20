'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ActionResult } from '@/lib/form';
import { useToast } from './Toast';

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  /** Content of the button that opens the modal. */
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  /** Server action; receives the form's FormData. */
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel?: string;
  /** Form fields. */
  children: React.ReactNode;
};

/** A button that opens a modal form and submits it to a server action. */
export function FormModal({ trigger, triggerClassName = 'primary-btn', triggerLabel, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)} aria-label={triggerLabel} title={triggerLabel}>
        {trigger}
      </button>
      {open && <ModalForm {...rest} onClose={() => setOpen(false)} />}
    </>
  );
}

function ModalForm({ title, eyebrow, description, action, submitLabel = 'Save', children, onClose }: Omit<Props, 'trigger' | 'triggerClassName' | 'triggerLabel'> & { onClose: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !pending && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await action(new FormData(e.currentTarget));
      if (result.ok) {
        toast(result.message);
        onClose();
        return;
      }
      setError(result.error);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setPending(false);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {description && <p className="modal-desc">{description}</p>}
        <form className="form" onSubmit={onSubmit}>
          {children}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose} disabled={pending}>Cancel</button>
            <button className="primary-btn" disabled={pending}>{pending ? 'Saving…' : submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
