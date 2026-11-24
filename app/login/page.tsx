import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Log in | INDOOR ACADEMY' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  // Only allow redirects back into this app.
  const next = searchParams.next && searchParams.next.startsWith('/') && !searchParams.next.startsWith('//') ? searchParams.next : '/';
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark"><span>IA</span><i /></div>
          <div>
            <b>INDOOR<span>ACADEMY</span></b>
            <small>CRICKET PERFORMANCE CENTER</small>
          </div>
        </div>
        <h1>Log in</h1>
        <p className="login-sub">Use the account given to you by the academy administrator.</p>
        <LoginForm next={next} />
        <p className="login-alt">Parent or student? <Link href="/parent/login">Parent app login</Link></p>
        <p className="login-alt login-home"><Link href="/home" prefetch={false}>← Back to home page</Link></p>
      </section>
    </main>
  );
}
