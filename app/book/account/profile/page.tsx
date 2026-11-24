import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCustomer } from '@/lib/rentals/account';
import { ActionForm } from '@/components/rentals/ActionForm';
import { changeMyPassword, updateProfile } from '../../actions';

export const metadata = { title: 'Your profile' };

/** Profile of an outside customer. Academy families are managed by the academy (parent app). */
export default async function ProfilePage() {
  const customer = await getCustomer();
  if (!customer) redirect('/book/account');
  return (
    <>
      <Link href="/book/account" className="back-link"><ArrowLeft size={14} /> My bookings</Link>
      <div className="bk-title"><div><h1>Your profile</h1><p>Used for your bookings, confirmations and receipts.</p></div></div>
      <div className="two-col">
        <section className="bk-card">
          <div className="panel-head"><div><h3>Details</h3><p>Your mobile number is your login: {customer.phone}. Call the academy to change it.</p></div></div>
          <ActionForm action={updateProfile} submitLabel="Save profile" pendingLabel="Saving…">
            <label>Name *<input name="name" required maxLength={80} defaultValue={customer.name} autoComplete="name" /></label>
            <label>Email <small className="muted">(for confirmations and receipts)</small><input name="email" type="email" maxLength={120} defaultValue={customer.email ?? ''} autoComplete="email" /></label>
          </ActionForm>
        </section>
        <section className="bk-card">
          <div className="panel-head"><div><h3>Change password</h3><p>Other devices are logged out when you change it.</p></div></div>
          <ActionForm action={changeMyPassword} submitLabel="Change password" pendingLabel="Changing…">
            <label>Current password *<input name="current" type="password" autoComplete="current-password" required /></label>
            <label>New password * <small className="muted">(at least 8 characters)</small><input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
            <label>Confirm new password *<input name="confirm" type="password" minLength={8} autoComplete="new-password" required /></label>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
