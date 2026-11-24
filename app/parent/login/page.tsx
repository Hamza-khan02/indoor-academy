import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFamily } from '@/lib/family';
import { getSettings } from '@/lib/settings';
import { initials } from '@/lib/format';
import { ParentLoginForm } from './ParentLoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Parent login' };

export default async function ParentLoginPage() {
  if (await getFamily()) redirect('/parent');
  const settings = await getSettings();
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark"><span>{initials(settings.academyName) || 'IA'}</span><i /></div>
          <div>
            <b>{settings.academyName}</b>
            <small>PARENT &amp; STUDENT APP</small>
          </div>
        </div>
        <h1>Log in</h1>
        <p className="login-sub">
          Use the guardian phone number registered with the academy and the 6-digit PIN the academy sent you.
          See attendance, fees, receipts, coach ratings and the training schedule.
        </p>
        <ParentLoginForm />
        <p className="login-alt">Academy staff? <Link href="/login">Staff login</Link></p>
        <p className="login-alt login-home"><Link href="/home" prefetch={false}>← Back to home page</Link></p>
      </section>
    </main>
  );
}
