// Printable receipt for a booking: what was booked, how the amount is made up and every payment
// and refund on it. Shared by the staff section and the customer's booking account.
import { formatDate } from '@/lib/dates';
import { initials, inr, rupeesInWords } from '@/lib/format';
import { BOOKING_STATUS, PAYMENT_METHODS } from '@/lib/rentals/constants';
import type { PriceLine } from '@/lib/rentals/pricing';
import { rangeLabel } from '@/lib/rentals/time';

type Props = {
  academy: { name: string; address: string; phone: string; note: string };
  booking: {
    code: string; kind: string; status: string; date: string; startMin: number; endMin: number; returnDate: string | null;
    customerName: string; customerPhone: string; customerType: string;
    total: number; deposit: number; paid: number;
    facility: string; pkg: string | null; units: string[]; lines: PriceLine[];
    payments: { receiptNo: string | null; amount: number; method: string; reference: string | null; paidAt: Date | null }[];
    refunds: { amount: number; processedAt: Date | null; method: string | null }[];
  };
};

const day = (d: Date | null) => (d ? formatDate(new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10)) : '—');

export function RentalReceipt({ academy, booking: b }: Props) {
  const when = b.kind === 'EQUIPMENT'
    ? `${formatDate(b.date)}${b.returnDate && b.returnDate !== b.date ? ` to ${formatDate(b.returnDate)}` : ''}`
    : `${formatDate(b.date)}, ${rangeLabel(b.startMin, b.endMin)}`;
  const due = Math.max(0, b.total + b.deposit - b.paid);
  return (
    <article className="receipt">
      <header className="receipt-head">
        <div className="receipt-brand">
          <div className="receipt-mark">{initials(academy.name) || 'IA'}</div>
          <div>
            <h1>{academy.name}</h1>
            {academy.address && <p>{academy.address}</p>}
            {academy.phone && <p>Phone: {academy.phone}</p>}
          </div>
        </div>
        <div className="receipt-meta">
          <h2>BOOKING RECEIPT</h2>
          <dl>
            <dt>Booking ID</dt><dd>{b.code}</dd>
            <dt>Status</dt><dd>{BOOKING_STATUS[b.status]?.label ?? b.status}</dd>
          </dl>
        </div>
      </header>

      <section className="receipt-party">
        <p>Customer: <b>{b.customerName}</b> ({b.customerPhone}){b.customerType === 'STUDENT' ? ' · academy student' : ''}</p>
        <dl>
          <dt>Booked</dt><dd>{[b.facility, b.pkg].filter(Boolean).join(' · ')}{b.units.length ? ` (${b.units.join(' + ')})` : ''}</dd>
          <dt>When</dt><dd>{when}</dd>
        </dl>
      </section>

      <table className="receipt-table">
        <thead><tr><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          {b.lines.map((l, i) => <tr key={i}><td>{l.label}</td><td>{l.amount < 0 ? `− ${inr(-l.amount)}` : inr(l.amount)}</td></tr>)}
          {b.deposit > 0 && <tr><td>Refundable security deposit</td><td>{inr(b.deposit)}</td></tr>}
        </tbody>
        <tfoot><tr><td>Total</td><td>{inr(b.total + b.deposit)}</td></tr></tfoot>
      </table>

      {b.payments.length > 0 && (
        <table className="receipt-table">
          <thead><tr><th>Payments received</th><th>Amount</th></tr></thead>
          <tbody>
            {b.payments.map((p, i) => (
              <tr key={i}><td>{p.receiptNo ?? 'Payment'} · {day(p.paidAt)} · {PAYMENT_METHODS[p.method] ?? p.method}{p.reference ? ` · Ref: ${p.reference}` : ''}</td><td>{inr(p.amount)}</td></tr>
            ))}
            {b.refunds.map((r, i) => <tr key={`r${i}`}><td>Refund · {day(r.processedAt)}{r.method ? ` · ${PAYMENT_METHODS[r.method] ?? r.method}` : ''}</td><td>− {inr(r.amount)}</td></tr>)}
          </tbody>
          <tfoot><tr><td>Net amount received</td><td>{inr(b.paid)}</td></tr></tfoot>
        </table>
      )}

      <p className="receipt-words"><span>Received in words:</span> {rupeesInWords(b.paid)}</p>
      <p className="receipt-method"><span>Balance:</span> {due > 0 ? `${inr(due)} still to pay` : 'Nothing more to pay'}</p>

      <footer className="receipt-foot">
        <p className="receipt-note">{academy.note}</p>
        <div className="receipt-sign"><div className="sign-line" /><span>Authorised signatory</span></div>
      </footer>
    </article>
  );
}
