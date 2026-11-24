import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GraduationCap, UserRound } from 'lucide-react';
import { getBooker } from '@/lib/rentals/account';
import { parentLogin } from '@/app/parent/actions';
import { ActionForm } from '@/components/rentals/ActionForm';
import { loginCustomer } from '../actions';

export const metadata = { title: 'Log in to book' };

/** Only allow coming back to a page of the booking site. */
function safeNext(next?: string) {
  return next && next.startsWith('/book') && !next.startsWith('//') ? next : '/book/account';
}

export default async function BookLoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await props.searchParams).next);
  if (await getBooker()) redirect(next);
  return (
    <>
      <div className="bk-title"><div><h1>Log in to book</h1><p>Choose how you know the academy. Each person needs only one login.</p></div></div>
      <div className="two-col">
        <section className="bk-card">
          <div className="panel-head"><div><h3><UserRound size={17} /> Outside customer</h3><p>Not enrolled at the academy? Book with your own account.</p></div></div>
          <ActionForm action={loginCustomer} submitLabel="Log in" pendingLabel="Logging in…" next={next}>
            <label>Mobile number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          </ActionForm>
          <p className="login-alt">New here? <Link href={`/book/register?next=${encodeURIComponent(next)}`}>Create an account</Link></p>
          <p className="login-alt login-home">Forgot your password? Call the academy and we will set a new one.</p>
        </section>
        <section className="bk-card">
          <div className="panel-head"><div><h3><GraduationCap size={17} /> Academy family</h3><p>Students and parents: use the parent app login. Student prices are applied automatically.</p></div></div>
          <ActionForm action={parentLogin} submitLabel="Log in" pendingLabel="Logging in…" next={next}>
            <label>Guardian phone number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required /></label>
            <label>6-digit PIN<input name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="current-password" placeholder="6 digits" required /></label>
          </ActionForm>
          <p className="login-alt login-home">The PIN is the one the academy sent you for the parent app.</p>
        </section>
      </div>
    </>
  );
}
