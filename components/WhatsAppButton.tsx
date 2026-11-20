'use client';

import { MessageCircle } from 'lucide-react';
import { logReminder } from '@/lib/reminder-actions';

/**
 * Opens WhatsApp (app or web) with the message typed in; the user presses Send there.
 * When `log` is given, the click is recorded so others can see the parent was reminded.
 */
export function WhatsAppButton({
  href,
  log,
  label = 'WhatsApp',
  compact = false,
}: {
  href: string | null;
  log?: { studentId: string; kind: 'FEE' | 'ABSENT'; ref: string };
  label?: string;
  compact?: boolean;
}) {
  if (!href) {
    return (
      <span className={`wa-btn disabled ${compact ? 'compact' : ''}`} title="The guardian phone number cannot be used on WhatsApp">
        <MessageCircle size={14} />{!compact && label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`wa-btn ${compact ? 'compact' : ''}`}
      title={`${label} on WhatsApp`}
      aria-label={`${label} on WhatsApp`}
      onClick={() => {
        if (log) logReminder(log.studentId, log.kind, log.ref).catch(() => {});
      }}
    >
      <MessageCircle size={14} />{!compact && label}
    </a>
  );
}
