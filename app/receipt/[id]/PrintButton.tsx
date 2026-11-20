'use client';

import { Printer } from 'lucide-react';

/** Opens the browser print dialog, where the receipt can also be saved as a PDF. */
export function PrintButton() {
  return (
    <button type="button" className="primary-btn" onClick={() => window.print()}>
      <Printer size={15} /> Print / Save as PDF
    </button>
  );
}
