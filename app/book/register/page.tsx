import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getBooker } from '@/lib/rentals/account';
import { ActionForm } from '@/components/rentals/ActionForm';
import { registerCustomer } from '../actions';

export const metadata = { title: 'Create a booking account' };

export default async function BookRegisterPage(props: { searchParams: Promise<{ next?: string }> }) {
  const raw = (await props.searchParams).next;
  const next = raw && raw.startsWith('/book') && !raw.startsWith('//') ? raw : '/book';
  if (await getBooker()) redirect(next);
  return (
    <section className="bk-card bk-auth">
      <div className="panel-head"><div><h3>Create your booking account</h3><p>For customers who are not enrolled at the academy. It takes a minute, and no admission is needed.</p></div></div>
      <ActionForm action={registerCustomer} submitLabel="Create account" pendingLabel="Creating…" next={next}>
        <label>Your name *<input name="name" required maxLength={80} autoComplete="name" /></label>
        <label>Mobile number *<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required /></label>
        <label>Email <small className="muted">(optional, for confirmations and receipts)</small><input name="email" type="email" autoComplete="email" maxLength={120} /></label>
        <label>Password * <small className="muted">(at least 8 characters)</small><input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
      </ActionForm>
      <p className="login-alt">Already have an account, or an academy family? <Link href={`/book/login?next=${encodeURIComponent(next)}`}>Log in</Link></p>
    </section>
  );
}
