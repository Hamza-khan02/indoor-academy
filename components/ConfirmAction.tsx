'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/lib/form';
import { useToast } from './Toast';

/** A button that asks for confirmation, then runs a server action (e.g. delete). */
export function ConfirmAction({
  action,
  confirmText,
  children,
  className = 'icon-action danger',
  label,
  redirectTo,
}: {
  action: () => Promise<ActionResult>;
  confirmText: string;
  children: React.ReactNode;
  className?: string;
  label?: string;
  /** Where to go after success (e.g. back to a list after deleting a detail page's record). */
  redirectTo?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (!window.confirm(confirmText)) return;
    setPending(true);
    try {
      const result = await action();
      if (result.ok) {
        toast(result.message);
        if (redirectTo) router.push(redirectTo);
      } else {
        toast(result.error, 'error');
      }
    } catch {
      toast('Could not reach the server. Please try again.', 'error');
    }
    setPending(false);
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={pending} aria-label={label} title={label}>
      {children}
    </button>
  );
}
