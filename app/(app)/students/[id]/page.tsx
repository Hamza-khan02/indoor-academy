import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ATTENDANCE_STATUS, PAYMENT_METHODS } from '@/lib/constants';
import { addDays, ageFrom, currentMonth, formatDate, monthLabel, todayISO } from '@/lib/dates';
import { inr, percent } from '@/lib/format';
import { attended, formOptions } from '@/lib/queries';
import { whatsappUrl } from '@/lib/messages';
import { absenceNoticeUrl, feeReminderUrl, getSettings, receiptMessageUrl } from '@/lib/settings';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { ParentAccessButton } from '@/components/ParentAccessButton';
import { ensurePhoneKeys, phoneKey } from '@/lib/family';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { AttendanceBar, Avatar, Empty, Panel, StatusPill } from '@/components/ui';
import { StudentFields } from '../StudentFields';
import { deleteStudent, updateStudent } from '../actions';
import { PaymentFields } from '../../fees/PaymentFields';
import { deletePayment, recordPayment } from '../../fees/actions';
import { AssessmentFields } from '../../performance/AssessmentFields';
import { addAssessment, deleteAssessment } from '../../performance/actions';

export default async function StudentPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const student = await db.student.findUnique({
    where: { id: params.id },
    include: {
      branch: true,
      batch: { include: { coach: true } },
      attendance: { orderBy: { date: 'desc' }, take: 60 },
      payments: { orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }] },
      assessments: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] },
      reminders: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!student) notFound();
  const [options, settings] = await Promise.all([formOptions(), getSettings()]);
  const contact = { ...student, batchName: student.batch?.name };
  const lastAbsence = student.attendance.find((a) => a.status === 'ABSENT' && a.date >= addDays(todayISO(), -13));

  // Parent app access is per guardian phone, shared by siblings with the same number.
  const familyKey = phoneKey(student.guardianPhone);
  if (isAdmin && familyKey) await ensurePhoneKeys();
  const [familyLogin, siblings] = isAdmin && familyKey
    ? await Promise.all([
        db.familyLogin.findUnique({ where: { phoneKey: familyKey } }),
        db.student.findMany({ where: { guardianPhoneKey: familyKey, id: { not: student.id } }, select: { id: true, name: true } }),
      ])
    : [null, []];

  const since = addDays(todayISO(), -29);
  const recent = student.attendance.filter((a) => a.date >= since);
  const pct30 = percent(recent.filter((a) => attended(a.status)).length, recent.length);
  const month = currentMonth();
  const fee = student.batch?.monthlyFee ?? 0;
  const paidThisMonth = student.payments.filter((p) => p.forMonth === month).reduce((s, p) => s + p.amount, 0);
  const latest = student.assessments[0];
  const avg = (a: { batting: number; bowling: number; fielding: number; fitness: number }) => ((a.batting + a.bowling + a.fielding + a.fitness) / 4).toFixed(1);
  const age = ageFrom(student.dob);

  return (
    <>
      <Link href="/students" className="back-link"><ArrowLeft size={14} /> All students</Link>
      <div className="profile-head panel padded">
        <Avatar name={student.name} />
        <div className="profile-head-copy">
          <h1>{student.name}</h1>
          <p>{student.ageGroup}{student.playingRole ? ` · ${student.playingRole}` : ''}{age !== null ? ` · ${age} years` : ''} · {student.branch.name}</p>
        </div>
        <StatusPill status={student.status} />
        <div className="row-actions">
          <FormModal title={`Edit ${student.name}`} trigger={<><Pencil size={15} /> Edit</>} triggerClassName="secondary-btn" action={updateStudent.bind(null, student.id)}>
            <StudentFields options={options} student={student} />
          </FormModal>
          {isAdmin && (
            <ConfirmAction action={deleteStudent.bind(null, student.id)} redirectTo="/students" className="secondary-btn danger" confirmText={`Delete ${student.name}? Their attendance, fee and assessment records will also be deleted. This cannot be undone.`}>
              <Trash2 size={15} /> Delete
            </ConfirmAction>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card"><div className="stat-top"><span>Attendance (30 days)</span></div><div className="stat-value">{pct30 === null ? '—' : `${pct30}%`}</div><div className="stat-foot">{recent.length} sessions marked</div></article>
        <article className="stat-card"><div className="stat-top"><span>Fee for {monthLabel(month)}</span></div><div className="stat-value">{fee ? inr(Math.max(0, fee - paidThisMonth)) : '—'}</div><div className="stat-foot">{fee ? (paidThisMonth >= fee ? 'Paid in full' : `due of ${inr(fee)}`) : 'No batch fee set'}</div></article>
        <article className="stat-card"><div className="stat-top"><span>Latest assessment</span></div><div className="stat-value">{latest ? `${avg(latest)}/10` : '—'}</div><div className="stat-foot">{latest ? formatDate(latest.date) : 'Not assessed yet'}</div></article>
        <article className="stat-card"><div className="stat-top"><span>Batch</span></div><div className="stat-value small">{student.batch?.name ?? 'Not assigned'}</div><div className="stat-foot">{student.batch?.coach ? `Coach ${student.batch.coach.name}` : 'No coach assigned'}</div></article>
      </div>

      <div className="two-col">
        <Panel title="Details">
          <dl className="details">
            <dt>Guardian</dt><dd>{student.guardianName ?? '—'}</dd>
            <dt>Phone</dt>
            <dd className="wa-cell">
              <a href={`tel:${student.guardianPhone.replace(/\s/g, '')}`}>{student.guardianPhone}</a>
              <WhatsAppButton href={whatsappUrl(student.guardianPhone)} label="Chat" compact />
            </dd>
            <dt>Date of birth</dt><dd>{formatDate(student.dob)}</dd>
            <dt>Joined</dt><dd>{formatDate(student.joinedOn)}</dd>
            <dt>Branch</dt><dd>{student.branch.name}</dd>
            <dt>Notes</dt><dd>{student.notes ?? '—'}</dd>
            {isAdmin && (
              <>
                <dt>Parent app</dt>
                <dd className="parent-access">
                  {!familyKey ? (
                    <span className="muted">Guardian phone isn&apos;t valid, so no login can be made.</span>
                  ) : (
                    <>
                      <span>
                        {!familyLogin ? <span className="muted">Not set up</span>
                          : !familyLogin.active ? <span className="c-absent">Switched off</span>
                          : <span className="c-present">Active{familyLogin.lastLoginAt ? ` · last login ${formatDate(todayISO(familyLogin.lastLoginAt))}` : ' · not used yet'}</span>}
                        {siblings.length > 0 && <small className="muted block">Same login shows: {siblings.map((s) => s.name).join(', ')}</small>}
                      </span>
                      <ParentAccessButton studentId={student.id} hasLogin={!!familyLogin} className="text-btn" />
                    </>
                  )}
                </dd>
              </>
            )}
            <dt>WhatsApp</dt>
            <dd className="wa-actions">
              {isAdmin && fee > 0 && paidThisMonth < fee && (
                <WhatsAppButton
                  href={feeReminderUrl(settings, contact, fee - paidThisMonth, month)}
                  log={{ studentId: student.id, kind: 'FEE', ref: month }}
                  label={`Fee reminder (${inr(fee - paidThisMonth)})`}
                />
              )}
              {lastAbsence && (
                <WhatsAppButton
                  href={absenceNoticeUrl(settings, contact, lastAbsence.date)}
                  log={{ studentId: student.id, kind: 'ABSENT', ref: lastAbsence.date }}
                  label={`Absent on ${formatDate(lastAbsence.date)}`}
                />
              )}
              {!(isAdmin && fee > 0 && paidThisMonth < fee) && !lastAbsence && <span className="muted">No fee due or recent absence</span>}
            </dd>
            {student.reminders.length > 0 && (
              <>
                <dt>Reminders sent</dt>
                <dd>
                  <ul className="reminder-log">
                    {student.reminders.map((r) => (
                      <li key={r.id}>
                        {r.kind === 'FEE'
                          ? `Fee reminder · ${monthLabel(r.ref)}`
                          : r.kind === 'RECEIPT'
                            ? `Receipt · ${student.payments.find((p) => p.id === r.ref)?.receiptNo ?? 'deleted payment'}`
                            : `Absent · ${formatDate(r.ref)}`}
                        <small className="muted"> — {formatDate(todayISO(r.createdAt))}{r.sentBy ? ` by ${r.sentBy}` : ''}</small>
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
          </dl>
        </Panel>

        <Panel title="Attendance history" subtitle="Most recent 60 sessions" action={<AttendanceBar pct={pct30} />}>
          {student.attendance.length === 0 ? <Empty title="No attendance marked yet" /> : (
            <div className="att-history">
              {student.attendance.map((a) => (
                <span key={a.id} className={`att-chip ${a.status.toLowerCase()}`} title={`${formatDate(a.date)}: ${ATTENDANCE_STATUS[a.status]}`}>
                  {a.date.slice(8)}/{a.date.slice(5, 7)}
                </span>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="two-col">
        {isAdmin && (
          <Panel
            title="Fee payments"
            subtitle={fee ? `Batch fee ${inr(fee)} / month` : 'No monthly fee set on the batch'}
            action={
              <FormModal title="Record payment" eyebrow={student.name.toUpperCase()} trigger={<><Plus size={14} /> Record</>} triggerClassName="text-btn" action={recordPayment} submitLabel="Save payment">
                <PaymentFields studentId={student.id} amount={Math.max(0, fee - paidThisMonth) || fee} />
              </FormModal>
            }
          >
            {student.payments.length === 0 ? <Empty title="No payments recorded" /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>RECEIPT</th><th>PAID ON</th><th>FOR</th><th>AMOUNT</th><th>METHOD</th><th /></tr></thead>
                  <tbody>
                    {student.payments.map((p) => (
                      <tr key={p.id}>
                        <td><Link className="text-btn" href={`/receipt/${p.id}`} target="_blank">{p.receiptNo ?? 'View'}</Link></td>
                        <td>{formatDate(p.paidOn)}</td>
                        <td>{monthLabel(p.forMonth)}</td>
                        <td><b>{inr(p.amount)}</b></td>
                        <td>{PAYMENT_METHODS[p.method] ?? p.method}{p.reference ? <small className="muted"> · {p.reference}</small> : null}</td>
                        <td>
                          <div className="row-actions">
                            <WhatsAppButton href={receiptMessageUrl(settings, contact, p)} log={{ studentId: student.id, kind: 'RECEIPT', ref: p.id }} label="Send receipt" compact />
                            <ConfirmAction action={deletePayment.bind(null, p.id)} confirmText={`Delete this payment of ${inr(p.amount)}?${p.receiptNo ? ` Receipt ${p.receiptNo} will be cancelled.` : ''}`} label="Delete"><Trash2 size={14} /></ConfirmAction>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        <Panel
          title="Assessments"
          subtitle="Coach ratings out of 10"
          action={
            <FormModal title="New assessment" eyebrow={student.name.toUpperCase()} trigger={<><Plus size={14} /> Add</>} triggerClassName="text-btn" action={addAssessment} submitLabel="Save assessment">
              <AssessmentFields studentId={student.id} />
            </FormModal>
          }
        >
          {student.assessments.length === 0 ? <Empty title="No assessments yet" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>DATE</th><th>BAT</th><th>BOWL</th><th>FIELD</th><th>FIT</th><th>AVG</th><th>NOTES</th>{isAdmin && <th />}</tr></thead>
                <tbody>
                  {student.assessments.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDate(a.date)}<small className="muted block">{a.coachName}</small></td>
                      <td>{a.batting}</td><td>{a.bowling}</td><td>{a.fielding}</td><td>{a.fitness}</td>
                      <td><b>{avg(a)}</b></td>
                      <td className="wrap">{a.notes ?? '—'}</td>
                      {isAdmin && <td><ConfirmAction action={deleteAssessment.bind(null, a.id)} confirmText="Delete this assessment?" label="Delete"><Trash2 size={14} /></ConfirmAction></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
