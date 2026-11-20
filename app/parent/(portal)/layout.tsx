import { LogOut, Phone } from 'lucide-react';
import { requireFamily } from '@/lib/family';
import { getSettings } from '@/lib/settings';
import { initials } from '@/lib/format';
import { parentLogout } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Parent app' };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireFamily();
  const settings = await getSettings();
  return (
    <div className="portal">
      <header className="portal-header">
        <div className="brand portal-brand">
          <div className="brand-mark"><span>{initials(settings.academyName) || 'IA'}</span><i /></div>
          <div>
            <b>{settings.academyName}</b>
            <small>PARENT &amp; STUDENT APP</small>
          </div>
        </div>
        <form action={parentLogout}>
          <button className="secondary-btn" aria-label="Log out"><LogOut size={15} /> Log out</button>
        </form>
      </header>
      <main className="portal-content">{children}</main>
      <footer className="portal-footer">
        {settings.academyPhone && <a href={`tel:${settings.academyPhone.replace(/\s/g, '')}`}><Phone size={13} /> {settings.academyPhone}</a>}
        <span>{settings.academyName}{settings.academyAddress ? ` · ${settings.academyAddress}` : ''}</span>
      </footer>
    </div>
  );
}
