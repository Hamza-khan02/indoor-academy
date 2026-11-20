import Link from 'next/link';
import { Download, FileText, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { photoUrl } from '@/lib/photos';
import { requireAdminPage } from '@/lib/auth';
import { PAYMENT_METHODS } from '@/lib/constants';
import { currentMonth, formatDate, monthLabel, todayISO } from '@/lib/dates';
import { inr } from '@/lib/format';
import { feeReminderUrl, getSettings, receiptMessageUrl } from '@/lib/settings';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Avatar, Empty, PageHeader, Panel, StatCard } from '@/components/ui';
import { PaymentFields } from './PaymentFields';
import { deletePayment, recordPayment } from './actions';
import { CircleDollarSign, Clock3, Users, Wallet } from 'lucide-react';

export default async function FeesPage({ searchParams }: { searchParams: { month?: string; show?: string } }) {
  await requireAdminPage();
  const month = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : currentMonth();
  const showAll = searchParams.show === 'all';

  const [students, payments, settings, reminders] = await Promise.all([
    db.student.findMany({
      where: { status: { not: 'INACTIVE' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, guardianName: true, guardianPhone: true, photoUpdatedAt: true, batch: { select: { name: true, monthlyFee: true } } },
    }),
    db.feePayment.findMany({
      where: { forMonth: month },
      orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
      include: { student: { select: { name: true, guardianName: true, guardianPhone: true, batch: { select: { name: true } } } } },
    }),
    getSettings(),
    db.reminder.groupBy({ by: ['studentId'], where: { kind: 'FEE', ref: month }, _count: { _all: true }, _max: { createdAt: true } }),
  ]);
  const reminded = new Map(reminders.map((r) => [r.studentId, { count: r._count._all, last: r._max.createdAt }]));
  const receiptSent = new Set(
    (await db.reminder.findMany({ where: { kind: 'RECEIPT', ref: { in: payments.map((p) => p.id) } }, select: { ref: true } })).map((r) => r.ref),
  );

  const paidBy = new Map<string, number>();
  for (const p of payments) paidBy.set(p.studentId, (paidBy.get(p.studentId) ?? 0) + p.amount);

  const rows = students
    .filter((s) => (s.batch?.monthlyFee ?? 0) > 0)
    .map((s) => {
      const fee = s.batch!.monthlyFee;
      const paid = paidBy.get(s.id) ?? 0;
      return { ...s, fee, paid, due: Math.max(0, fee - paid) };
    });
  const expected = rows.reduce((t, r) => t + r.fee, 0);
  const collected = payments.reduce((t, p) => t + p.amount, 0);
  const pending = rows.reduce((t, r) => t + r.due, 0);
  const dueRows = rows.filter((r) => r.due > 0);
  const visible = showAll ? rows : dueRows;
  const noFee = students.length - rows.length;

  const recordButton = (
    <FormModal title="Record payment" eyebrow="FEES & FINANCE" trigger={<><Plus size={17} /> Record payment</>} action={recordPayment} submitLabel="Save payment">
      <PaymentFields students={students} forMonth={month} />
    </FormModal>
  );

  return (
    <>
      <PageHeader
        title="Fees & Finance"
        subtitle={`Monthly fees for ${monthLabel(month)}, based on each student's batch fee.`}
        actions={<><a className="secondary-btn" href="/api/export/payments"><Download size={16} /> Export CSV</a>{students.length > 0 && recordButton}</>}
      />
      <form className="filters panel" method="get">
        <label className="inline">Month <input type="month" name="month" defaultValue={month} /></label>
        <button className="secondary-btn">Go</button>
        {month !== currentMonth() && <Link className="text-btn" href="/fees">This month</Link>}
      </form>

      <div className="stats-grid">
        <StatCard title="Expected" value={inr(expected)} detail={`${rows.length} students with a batch fee`} icon={<Wallet size={17} />} color="blue" />
        <StatCard title="Collected" value={inr(collected)} detail={`${payments.length} payments`} icon={<CircleDollarSign size={17} />} color="green" />
        <StatCard title="Pending" value={inr(pending)} detail={`${dueRows.length} students with dues`} icon={<Clock3 size={17} />} color="red" />
        <StatCard title="Collection rate" value={expected ? `${Math.round(((expected - pending) / expected) * 100)}%` : '—'} detail="of expected fees received" icon={<Users size={17} />} color="amber" />
      </div>

      <div className="two-col wide-left">
        <Panel
          title={showAll ? 'All students' : 'Pending dues'}
          subtitle={noFee > 0 ? `${noFee} active students have no batch fee and are not listed.` : undefined}
          action={<Link className="text-btn" href={`/fees?month=${month}${showAll ? '' : '&show=all'}`}>{showAll ? 'Show dues only' : 'Show all'}</Link>}
        >
          {visible.length === 0 ? (
            <Empty title={rows.length === 0 ? 'No fees set up' : 'No pending dues'}>
              {rows.length === 0 ? 'Set a monthly fee on each batch and assign students to batches.' : `Everyone has paid for ${monthLabel(month)}.`}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>STUDENT</th><th>BATCH</th><th>FEE</th><th>PAID</th><th>DUE</th><th>REMINDER</th><th /></tr></thead>
                <tbody>
                  {visible.map((r) => {
                    const sent = reminded.get(r.id);
                    return (
                      <tr key={r.id}>
                        <td><Link href={`/students/${r.id}`} className="player-cell"><Avatar name={r.name} small photo={photoUrl(r)} /><div><b>{r.name}</b><small>{r.guardianPhone}</small></div></Link></td>
                        <td><span className="batch-tag">{r.batch!.name}</span></td>
                        <td>{inr(r.fee)}</td>
                        <td>{inr(r.paid)}</td>
                        <td>{r.due > 0 ? <b className="c-absent">{inr(r.due)}</b> : <span className="c-present">Paid</span>}</td>
                        <td>
                          {r.due > 0 && (
                            <div className="wa-cell">
                              <WhatsAppButton
                                href={feeReminderUrl(settings, { ...r, batchName: r.batch!.name }, r.due, month)}
                                log={{ studentId: r.id, kind: 'FEE', ref: month }}
                                label={sent ? 'Remind again' : 'Remind'}
                              />
                              {sent?.last && <small className="muted">Sent {formatDate(todayISO(sent.last))}{sent.count > 1 ? ` · ${sent.count}×` : ''}</small>}
                            </div>
                          )}
                        </td>
                        <td>
                          {r.due > 0 && (
                            <FormModal title="Record payment" eyebrow={r.name.toUpperCase()} trigger="Collect" triggerClassName="text-btn" action={recordPayment} submitLabel="Save payment">
                              <PaymentFields studentId={r.id} amount={r.due} forMonth={month} />
                            </FormModal>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Payments received" subtitle={`Fees paid for ${monthLabel(month)}`}>
          {payments.length === 0 ? <Empty title="No payments yet" /> : (
            <ul className="payment-list">
              {payments.map((p) => (
                <li key={p.id}>
                  <div className="stack">
                    <b>{p.student.name}</b>
                    <small className="muted">{formatDate(p.paidOn)} · {PAYMENT_METHODS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ''}</small>
                    <small className="muted">
                      {p.receiptNo ?? 'No receipt no. yet'}
                      {receiptSent.has(p.id) && <span className="c-present"> · receipt sent</span>}
                    </small>
                  </div>
                  <strong>{inr(p.amount)}</strong>
                  <div className="row-actions">
                    <Link className="icon-action" href={`/receipt/${p.id}`} target="_blank" aria-label="Open receipt" title="Open receipt"><FileText size={15} /></Link>
                    <WhatsAppButton
                      href={receiptMessageUrl(settings, { ...p.student, batchName: p.student.batch?.name }, p)}
                      log={{ studentId: p.studentId, kind: 'RECEIPT', ref: p.id }}
                      label="Send receipt"
                      compact
                    />
                    <ConfirmAction action={deletePayment.bind(null, p.id)} confirmText={`Delete ${p.student.name}'s payment of ${inr(p.amount)}?${p.receiptNo ? ` Receipt ${p.receiptNo} will be cancelled.` : ''}`} label="Delete"><Trash2 size={14} /></ConfirmAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
