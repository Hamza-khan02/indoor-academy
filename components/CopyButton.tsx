'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Copies text to the clipboard (e.g. a notice to paste into a WhatsApp group). */
export function CopyButton({ text, label = 'Copy', className = 'icon-action wide' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      window.prompt('Copy this text:', text);
    }
  }
  return (
    <button type="button" className={className} onClick={copy} title="Copy text">
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? 'Copied' : label}
    </button>
  );
}
