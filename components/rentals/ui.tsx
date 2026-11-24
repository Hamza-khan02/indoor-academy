// Small presentational pieces for booking screens (server-safe, no hooks).
import { inr } from '@/lib/format';
import { BOOKING_STATUS, LINE_STATUS, SLOT_STATES } from '@/lib/rentals/constants';
import type { PriceLine } from '@/lib/rentals/pricing';

export function StatusChip({ status, big }: { status: string; big?: boolean }) {
  const s = BOOKING_STATUS[status] ?? { label: status, tone: 'grey' };
  return <span className={`rn-chip t-${s.tone}${big ? ' big' : ''}`}><i />{s.label}</span>;
}

export function LineChip({ status }: { status: string }) {
  const s = LINE_STATUS[status] ?? { label: status, tone: 'grey' };
  return <span className={`rn-chip t-${s.tone}`}><i />{s.label}</span>;
}

export function Chip({ tone, children }: { tone: 'green' | 'red' | 'amber' | 'grey' | 'blue'; children: React.ReactNode }) {
  return <span className={`rn-chip t-${tone}`}>{children}</span>;
}

/** The colour key of the calendar. */
export function Legend() {
  return (
    <div className="rn-legend">
      {Object.entries(SLOT_STATES).map(([key, s]) => <span key={key}><i className={`s-${key}`} />{s.label}</span>)}
    </div>
  );
}

export function parseLines(json: string | null | undefined): PriceLine[] {
  try {
    const lines = JSON.parse(json || '[]');
    return Array.isArray(lines) ? lines : [];
  } catch {
    return [];
  }
}

/** How a booking's price is made up, with what has been paid and what is still due. */
export function PriceLines({ lines, total, deposit, paid, showPaid = true }: { lines: PriceLine[]; total: number; deposit: number; paid?: number; showPaid?: boolean }) {
  const due = Math.max(0, total + deposit - (paid ?? 0));
  return (
    <ul className="rn-lines">
      {lines.map((l, i) => (
        <li key={i} className={l.amount < 0 ? 'minus' : undefined}><span>{l.label}</span><b>{l.amount < 0 ? `− ${inr(-l.amount)}` : inr(l.amount)}</b></li>
      ))}
      <li className="sum"><span>Booking amount</span><b>{inr(total)}</b></li>
      {deposit > 0 && <li className="soft"><span>Refundable security deposit</span><b>{inr(deposit)}</b></li>}
      {showPaid && paid !== undefined && (
        <>
          <li className="soft"><span>Paid so far</span><b>{inr(paid)}</b></li>
          <li className={due > 0 ? 'due' : 'minus'}><span>{due > 0 ? 'Still to pay' : 'Nothing more to pay'}</span><b>{inr(due)}</b></li>
        </>
      )}
    </ul>
  );
}

const FACILITY_TONE: Record<string, 'green' | 'amber' | 'grey'> = { ACTIVE: 'green', MAINTENANCE: 'amber', INACTIVE: 'grey' };
const FACILITY_LABEL: Record<string, string> = { ACTIVE: 'Open for booking', MAINTENANCE: 'Under maintenance', INACTIVE: 'Switched off' };
const UNIT_LABEL: Record<string, string> = { ACTIVE: 'Available', MAINTENANCE: 'Under maintenance', INACTIVE: 'Switched off' };

/** Open / maintenance / switched off, for a facility or one of its units. */
export function FacilityChip({ status, unit }: { status: string; unit?: boolean }) {
  return <span className={`rn-chip t-${FACILITY_TONE[status] ?? 'grey'}`}><i />{(unit ? UNIT_LABEL : FACILITY_LABEL)[status] ?? status}</span>;
}

const UNIT_WORD: Record<string, string> = { PER_30_MIN: '30 min', PER_HOUR: 'hour', PER_SESSION: 'session', PER_DAY: 'day', PER_ITEM: 'item' };

/** "₹ 500 / hour" */
export function priceText(pricing: { unit: string; price: number } | null | undefined) {
  if (!pricing) return 'Price not set';
  if (pricing.unit === 'PER_ITEM') return 'Priced per item';
  return pricing.price > 0 ? `${inr(pricing.price)} / ${UNIT_WORD[pricing.unit] ?? 'unit'}` : 'Price not set';
}
export const unitWord = (unit: string | null | undefined) => UNIT_WORD[unit ?? ''] ?? 'unit';
