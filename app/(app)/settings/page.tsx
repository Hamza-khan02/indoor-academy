import { KeyRound, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { USER_ROLES } from '@/lib/constants';
import { formatDate, todayISO } from '@/lib/dates';
import { displayPhone, ensurePhoneKeys } from '@/lib/family';
import { deleteFamilyLogin, setFamilyLoginActive, updatePortalSettings } from '@/lib/family-actions';
import { ParentAccessButton } from '@/components/ParentAccessButton';
import { financialYear, formatReceiptNo } from '@/lib/receipts';
import { updateReceiptSettings } from '@/lib/reminder-actions';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Avatar, PageHeader, Panel } from '@/components/ui';
import { getSettings } from '@/lib/settings';
import { changePassword, createUser, deleteUser, resetPassword } from './actions';
import { MessageTemplates } from './MessageTemplates';

export default async function SettingsPage() {
  const me = await requireUser();
  const isAdmin = me.role === 'ADMIN';
  const [users, messageSettings] = isAdmin
    ? await Promise.all([
        db.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }], select: { id: true, name: true, email: true, role: true } }),
        getSettings(),
      ])
    : [[], null];

  let familyLogins: { id: string; phoneKey: string; active: boolean; lastLoginAt: Date | null; students: { id: string; name: string }[] }[] = [];
  if (messageSettings) {
    await ensurePhoneKeys();
    const logins = await db.familyLogin.findMany({ orderBy: { createdAt: 'desc' } });
    const kids = await db.student.findMany({
      where: { guardianPhoneKey: { in: logins.map((l) => l.phoneKey) } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, guardianPhoneKey: true },
    });
    familyLogins = logins.map((l) => ({ ...l, students: kids.filter((k) => k.guardianPhoneKey === l.phoneKey) }));
  }

  let nextReceipt = '';
  if (messageSettings) {
    const fy = financialYear(todayISO());
    const counter = await db.setting.findUnique({ where: { key: `receiptSeq:${fy}` } });
    nextReceipt = formatReceiptNo(messageSettings.receiptPrefix, fy, (Number(counter?.value) || 0) + 1);
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and who can log in." />
      <div className="two-col">
        <Panel title="Your account" subtitle={`${me.email} · ${USER_ROLES[me.role] ?? me.role}`}>
          <div className="account-row">
            <Avatar name={me.name} />
            <div className="stack"><b>{me.name}</b><small className="muted">{me.email}</small></div>
            <FormModal title="Change password" trigger={<><KeyRound size={15} /> Change password</>} triggerClassName="secondary-btn" action={changePassword} submitLabel="Change password">
              <label>Current password *<input name="current" type="password" autoComplete="current-password" required /></label>
              <label>New password * <small className="muted">(at least 8 characters)</small><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
              <label>Confirm new password *<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
            </FormModal>
          </div>
        </Panel>

        {isAdmin && (
          <Panel
            title="Users"
            subtitle="Administrators can do everything. Coaches can manage students, attendance, assessments and tournaments, but not fees, branches, batches or users."
            action={
              <FormModal title="Add user" eyebrow="ACCESS" trigger={<><Plus size={14} /> Add user</>} triggerClassName="text-btn" action={createUser} submitLabel="Create login">
                <label>Name *<input name="name" required maxLength={80} /></label>
                <label>Email *<input name="email" type="email" required /></label>
                <div className="form-row">
                  <label>Role *
                    <select name="role" defaultValue="COACH">
                      {Object.entries(USER_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label>Temporary password *<input name="password" type="text" minLength={8} required autoComplete="off" /></label>
                </div>
                <p className="form-hint">Share the password with them privately and ask them to change it from Settings.</p>
              </FormModal>
            }
          >
            <ul className="user-list">
              {users.map((u) => (
                <li key={u.id}>
                  <Avatar name={u.name} small />
                  <div className="stack"><b>{u.name}{u.id === me.id ? ' (you)' : ''}</b><small className="muted">{u.email}</small></div>
                  <span className="batch-tag">{USER_ROLES[u.role] ?? u.role}</span>
                  {u.id !== me.id && (
                    <div className="row-actions">
                      <FormModal title={`Reset password for ${u.name}`} trigger={<KeyRound size={15} />} triggerClassName="icon-action" triggerLabel="Reset password" action={resetPassword.bind(null, u.id)} submitLabel="Reset password">
                        <label>New temporary password *<input name="password" type="text" minLength={8} required autoComplete="off" /></label>
                      </FormModal>
                      <ConfirmAction action={deleteUser.bind(null, u.id)} confirmText={`Remove ${u.name}'s login?`} label="Remove"><Trash2 size={15} /></ConfirmAction>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {messageSettings && (
        <Panel
          title="Parent app"
          subtitle="Parents and students log in at /parent/login with the guardian phone number and a PIN. Create a PIN from a student's profile (Parent app → Give parent access)."
          className="spaced-bottom"
          action={
            <FormModal title="Parent app address" eyebrow="PARENT APP" trigger={<><Pencil size={14} /> Address</>} triggerClassName="text-btn" action={updatePortalSettings} submitLabel="Save address">
              <label>Public address of this app<input name="publicUrl" defaultValue={messageSettings.publicUrl} placeholder="https://academy.example.com" /></label>
              <p className="form-hint">Fill this in once the app is online. It is used in the login link sent to parents. Leave empty to use the address you are using right now.</p>
            </FormModal>
          }
        >
          <p className="portal-address">
            Login link: <b>{messageSettings.publicUrl ? `${messageSettings.publicUrl}/parent/login` : 'not set — uses the address you open the app with'}</b>
          </p>
          {familyLogins.length === 0 ? (
            <p className="muted small-note">No parent logins yet.</p>
          ) : (
            <ul className="user-list">
              {familyLogins.map((f) => (
                <li key={f.id}>
                  <div className="stack">
                    <b>{displayPhone(f.phoneKey)}</b>
                    <small className="muted">
                      {f.students.length ? f.students.map((s) => s.name).join(', ') : 'No students with this number now'}
                      {' · '}{f.lastLoginAt ? `last login ${formatDate(todayISO(f.lastLoginAt))}` : 'never logged in'}
                    </small>
                  </div>
                  <span className={`batch-tag ${f.active ? '' : 'off'}`}>{f.active ? 'Active' : 'Switched off'}</span>
                  <div className="row-actions">
                    {f.students[0] && <ParentAccessButton studentId={f.students[0].id} hasLogin className="icon-action wide" />}
                    <ConfirmAction
                      action={setFamilyLoginActive.bind(null, f.id, !f.active)}
                      confirmText={f.active ? `Switch off the parent app login for ${displayPhone(f.phoneKey)}? They will be logged out.` : `Switch the login for ${displayPhone(f.phoneKey)} back on?`}
                      className="icon-action"
                      label={f.active ? 'Switch off' : 'Switch on'}
                    >
                      {f.active ? <PowerOff size={15} /> : <Power size={15} />}
                    </ConfirmAction>
                    <ConfirmAction action={deleteFamilyLogin.bind(null, f.id)} confirmText={`Remove the parent app login for ${displayPhone(f.phoneKey)}?`} label="Remove"><Trash2 size={15} /></ConfirmAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {messageSettings && (
        <Panel
          title="Receipt details"
          subtitle="Printed on every fee receipt. Receipt numbers look like PREFIX/2026-27/0001 and restart each financial year (April)."
          className="spaced-bottom"
          action={
            <FormModal title="Receipt details" eyebrow="FEE RECEIPTS" trigger={<><Pencil size={14} /> Edit</>} triggerClassName="text-btn" action={updateReceiptSettings} submitLabel="Save details">
              <div className="form-row">
                <label>Receipt prefix *<input name="receiptPrefix" required maxLength={10} defaultValue={messageSettings.receiptPrefix} placeholder="IA" /></label>
                <label>Academy phone<input name="academyPhone" type="tel" defaultValue={messageSettings.academyPhone} /></label>
              </div>
              <label>Academy address<textarea name="academyAddress" rows={2} maxLength={200} defaultValue={messageSettings.academyAddress} /></label>
              <label>Note at the bottom of receipts<textarea name="receiptNote" rows={2} maxLength={300} defaultValue={messageSettings.receiptNote} placeholder="e.g. Fees once paid are non-refundable." /></label>
              <p className="form-hint">The academy name is set under WhatsApp messages below. A new prefix applies to receipts created after saving.</p>
            </FormModal>
          }
        >
          <dl className="details">
            <dt>Academy</dt><dd>{messageSettings.academyName}</dd>
            <dt>Address</dt><dd>{messageSettings.academyAddress || <span className="muted">Not set</span>}</dd>
            <dt>Phone</dt><dd>{messageSettings.academyPhone || <span className="muted">Not set</span>}</dd>
            <dt>Next receipt</dt><dd>{nextReceipt}</dd>
            <dt>Footer note</dt><dd>{messageSettings.receiptNote || <span className="muted">None</span>}</dd>
          </dl>
        </Panel>
      )}

      {messageSettings && (
        <Panel
          title="WhatsApp messages"
          subtitle="Text that opens in WhatsApp when you press a reminder or receipt button. Words in {curly brackets} are filled in for each student."
        >
          <MessageTemplates initial={messageSettings} />
        </Panel>
      )}
    </>
  );
}
