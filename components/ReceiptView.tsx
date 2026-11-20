// The printable fee receipt, shared by the staff app and the parent app.
import { PAYMENT_METHODS } from '@/lib/constants';
import { formatDate, monthLabel } from '@/lib/dates';
import { initials, inr, rupeesInWords } from '@/lib/format';
import type { AppSettings } from '@/lib/settings';

type Props = {
  receiptNo: string;
  settings: AppSettings;
  payment: {
    amount: number; forMonth: string; paidOn: string; method: string; reference: string | null; recordedBy: string | null;
    student: { name: string; ageGroup: string; guardianName: string | null; batch: { name: string } | null; branch: { name: string } };
  };
};

export function ReceiptView({ receiptNo, settings, payment }: Props) {
  const s = payment.student;
  return (
    <article className="receipt">
      <header className="receipt-head">
        <div className="receipt-brand">
          <div className="receipt-mark">{initials(settings.academyName) || 'IA'}</div>
          <div>
            <h1>{settings.academyName}</h1>
            {settings.academyAddress && <p>{settings.academyAddress}</p>}
            {settings.academyPhone && <p>Phone: {settings.academyPhone}</p>}
          </div>
        </div>
        <div className="receipt-meta">
          <h2>FEE RECEIPT</h2>
          <dl>
            <dt>Receipt No.</dt><dd>{receiptNo}</dd>
            <dt>Date</dt><dd>{formatDate(payment.paidOn)}</dd>
          </dl>
        </div>
      </header>

      <section className="receipt-party">
        <p>Received with thanks from <b>{s.guardianName || `Parent / Guardian of ${s.name}`}</b></p>
        <dl>
          <dt>Student</dt><dd>{s.name} ({s.ageGroup})</dd>
          <dt>Batch</dt><dd>{s.batch?.name ?? '—'}</dd>
          <dt>Branch</dt><dd>{s.branch.name}</dd>
        </dl>
      </section>

      <table className="receipt-table">
        <thead><tr><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>Monthly fee for {monthLabel(payment.forMonth)}{s.batch ? ` (${s.batch.name})` : ''}</td><td>{inr(payment.amount)}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>Total received</td><td>{inr(payment.amount)}</td></tr>
        </tfoot>
      </table>

      <p className="receipt-words"><span>Amount in words:</span> {rupeesInWords(payment.amount)}</p>
      <p className="receipt-method"><span>Payment mode:</span> {PAYMENT_METHODS[payment.method] ?? payment.method}{payment.reference ? ` · Ref: ${payment.reference}` : ''}</p>

      <footer className="receipt-foot">
        <p className="receipt-note">{settings.receiptNote}</p>
        <div className="receipt-sign">
          <div className="sign-line" />
          <span>Authorised signatory{payment.recordedBy ? ` (${payment.recordedBy})` : ''}</span>
        </div>
      </footer>
    </article>
  );
}
