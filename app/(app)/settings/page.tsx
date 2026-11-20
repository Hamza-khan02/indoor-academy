import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { USER_ROLES } from '@/lib/constants';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Avatar, PageHeader, Panel } from '@/components/ui';
import { getMessageSettings } from '@/lib/settings';
import { changePassword, createUser, deleteUser, resetPassword } from './actions';
import { MessageTemplates } from './MessageTemplates';

export default async function SettingsPage() {
  const me = await requireUser();
  const isAdmin = me.role === 'ADMIN';
  const [users, messageSettings] = isAdmin
    ? await Promise.all([
        db.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }], select: { id: true, name: true, email: true, role: true } }),
        getMessageSettings(),
      ])
    : [[], null];

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
          title="WhatsApp messages"
          subtitle="Text that opens in WhatsApp when you press a reminder button. Words in {curly brackets} are filled in for each student."
        >
          <MessageTemplates initial={messageSettings} />
        </Panel>
      )}
    </>
  );
}
