import { headers } from 'next/headers';
import { Pencil } from 'lucide-react';
import { emailConfig, gatewayConfig, getRentalSettings } from '@/lib/rentals/settings';
import { getSettings } from '@/lib/settings';
import { requireRental } from '@/lib/rentals/staff';
import { FormModal } from '@/components/FormModal';
import { PageHeader, Panel } from '@/components/ui';
import { Check } from '@/components/rentals/fields';
import { Chip } from '@/components/rentals/ui';
import { saveRentalSettingsAction } from '../actions';

export default async function RentalSettingsPage() {
  await requireRental('config');
  const [s, app, h] = await Promise.all([getRentalSettings(), getSettings(), headers()]);
  const gateway = gatewayConfig();
  const email = emailConfig();
  const base = (app.publicUrl || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'}`).replace(/\/+$/, '');

  return (
    <>
      <PageHeader title="Booking settings" subtitle="Rules for online bookings, payments and reminders." />
      <div className="two-col">
        <Panel
          title="Booking rules"
          subtitle="Apply to bookings customers make themselves. Staff can always enter bookings by hand."
          action={
            <FormModal title="Booking rules" eyebrow="SETTINGS" trigger={<><Pencil size={14} /> Edit</>} triggerClassName="text-btn" action={saveRentalSettingsAction} submitLabel="Save settings">
              <div className="form-row">
                <label>Customers can book up to (days ahead) *<input name="bookingWindowDays" type="number" min={1} max={365} required defaultValue={s.bookingWindowDays} /></label>
                <label>Shortest notice (minutes before the slot) *<input name="minLeadMinutes" type="number" min={0} max={1440} required defaultValue={s.minLeadMinutes} /></label>
              </div>
              <div className="form-row">
                <label>Advance needed to confirm (% of amount) *<input name="advancePercent" type="number" min={0} max={100} required defaultValue={s.advancePercent} /></label>
                <label>Online payment hold (minutes) *<input name="holdMinutes" type="number" min={5} max={120} required defaultValue={s.holdMinutes} /></label>
              </div>
              <Check name="allowPayAtVenue" on={s.allowPayAtVenue} label={'Customers may choose "Pay at the academy"'} />
              <label>Hold for unpaid &quot;pay at the academy&quot; bookings (hours) * <small className="muted">(0 = confirm at once and collect at the counter)</small>
                <input name="offlineHoldHours" type="number" min={0} max={168} required defaultValue={s.offlineHoldHours} />
              </label>
              <div className="form-row">
                <label>Reschedule allowed until (hours before) *<input name="rescheduleCutoffHours" type="number" min={0} max={168} required defaultValue={s.rescheduleCutoffHours} /></label>
                <label>Reschedules per booking *<input name="maxReschedules" type="number" min={0} max={20} required defaultValue={s.maxReschedules} /></label>
              </div>
              <div className="form-row">
                <label>Reminder (hours before; 0 = off) *<input name="reminderHours" type="number" min={0} max={168} required defaultValue={s.reminderHours} /></label>
                <label>Receipt prefix *<input name="receiptPrefix" required maxLength={10} defaultValue={s.receiptPrefix} /></label>
              </div>
              <div className="form-row">
                <label>UPI ID for counter payments<input name="upiId" maxLength={60} defaultValue={s.upiId} placeholder="academy@upi" /></label>
                <label>Name on the UPI account<input name="upiName" maxLength={60} defaultValue={s.upiName} /></label>
              </div>
            </FormModal>
          }
        >
          <dl className="rn-kv">
            <dt>Booking window</dt><dd>{s.bookingWindowDays} days ahead, at least {s.minLeadMinutes} minutes before the slot</dd>
            <dt>To confirm</dt><dd>{s.advancePercent === 100 ? 'Full payment' : s.advancePercent === 0 ? 'No advance needed' : `${s.advancePercent}% advance`} (plus any security deposit)</dd>
            <dt>Online hold</dt><dd>{s.holdMinutes} minutes to pay, then the slot is released automatically</dd>
            <dt>Pay at academy</dt><dd>{!s.allowPayAtVenue ? 'Not offered to customers' : s.offlineHoldHours > 0 ? `Held unpaid for ${s.offlineHoldHours} hours, then released` : 'Confirmed at once; collected at the counter'}</dd>
            <dt>Reschedule</dt><dd>Up to {s.maxReschedules} times, until {s.rescheduleCutoffHours} hours before the start</dd>
            <dt>Reminder</dt><dd>{s.reminderHours > 0 ? `${s.reminderHours} hours before a booking` : 'Off'}</dd>
            <dt>Receipts</dt><dd>{s.receiptPrefix}/2026-27/0001 style numbers</dd>
            <dt>UPI at counter</dt><dd>{s.upiId ? `${s.upiId}${s.upiName ? ` (${s.upiName})` : ''}` : <span className="muted">Not set</span>}</dd>
          </dl>
          <p className="form-hint" style={{ marginTop: 14 }}>Cancellation charges and security deposits are set per facility under Pricing.</p>
        </Panel>

        <div className="rn-stack">
          <Panel title={<>Online payments {gateway ? <Chip tone="green">Set up</Chip> : <Chip tone="amber">Not set up</Chip>}</>} subtitle="Razorpay: UPI, cards and net banking.">
            {gateway ? (
              <dl className="rn-kv">
                <dt>Key ID</dt><dd>{gateway.keyId.slice(0, 12)}…</dd>
                <dt>Webhook</dt><dd>{gateway.webhookSecret ? 'Secret is set' : <span className="c-absent">Webhook secret missing: add RAZORPAY_WEBHOOK_SECRET</span>}</dd>
              </dl>
            ) : (
              <p className="rn-note warn">Customers currently see only &quot;Pay at the academy&quot;. To switch on online payment, the person who hosts the app adds the Razorpay keys below to the server&apos;s settings (the .env file) and restarts it.</p>
            )}
            <ol className="rn-setup" style={{ marginTop: 12 }}>
              <li><code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code>: from Razorpay Dashboard → Account &amp; Settings → API keys.</li>
              <li>In Razorpay → Webhooks, add this address with the events <code>payment.captured</code>, <code>payment.failed</code> and <code>refund.processed</code>: <code>{base}/api/rentals/webhook</code></li>
              <li><code>RAZORPAY_WEBHOOK_SECRET</code>: the secret you typed for that webhook.</li>
            </ol>
            <p className="form-hint" style={{ marginTop: 10 }}>A payment is counted only after the server has verified Razorpay&apos;s signature. The secret key never reaches the browser.</p>
          </Panel>

          <Panel title={<>Email notifications {email ? <Chip tone="green">Set up</Chip> : <Chip tone="amber">Not set up</Chip>}</>} subtitle="Confirmations, reminders, cancellations and refunds.">
            {email ? (
              <dl className="rn-kv"><dt>Sends from</dt><dd>{email.from}</dd><dt>Server</dt><dd>{email.host}:{email.port}</dd></dl>
            ) : (
              <p className="rn-note warn">Notifications are shown in the customer&apos;s booking account, but not emailed yet. To send emails, add <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>SMTP_FROM</code> to the server&apos;s settings (for Gmail: smtp.gmail.com, port 587, and an app password).</p>
            )}
            <p className="form-hint" style={{ marginTop: 10 }}>WhatsApp: every booking page has a &quot;Send on WhatsApp&quot; button with the message typed in, the same way fee reminders work.</p>
          </Panel>

          <Panel title="Automatic clean-up" subtitle="Expired holds are released whenever anyone books or opens the bookings section.">
            <p className="rn-note">For reminders to go out even when nobody has the app open, the host can call this address every few minutes (with <code>CRON_SECRET</code> set on the server): <code>{base}/api/rentals/housekeeping?key=CRON_SECRET</code></p>
          </Panel>
        </div>
      </div>
    </>
  );
}
