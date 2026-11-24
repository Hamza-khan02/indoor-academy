import '../rentals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, LogIn, LogOut, Phone, Smartphone, Warehouse } from 'lucide-react';
import { db } from '@/lib/db';
import { initials } from '@/lib/format';
import { getBooker, ownNotifications } from '@/lib/rentals/account';
import { runHousekeeping } from '@/lib/rentals/housekeeping';
import { getSettings } from '@/lib/settings';
import { ToastProvider } from '@/components/Toast';
import { bookingLogout } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { academyName } = await getSettings();
  return { title: `Book nets, turf and bowling machines | ${academyName}`, description: `Book cricket nets, turf, practice pitches, bowling machines and equipment at ${academyName}.` };
}

/** The customer booking site: its header (who is logged in), and the booking chores kept up to date. */
export default async function BookLayout({ children }: { children: React.ReactNode }) {
  const [booker, settings] = await Promise.all([getBooker(), getSettings()]);
  await runHousekeeping().catch((e) => console.error('Booking housekeeping failed', e));
  const unread = booker ? await db.rentalNotification.count({ where: { ...ownNotifications(booker), readAt: null } }) : 0;
  return (
    <ToastProvider>
      <div className="bk">
        <header className="bk-header">
          <Link className="brand" href="/home" aria-label={`${settings.academyName} home page`}>
            <div className="brand-mark"><span>{initials(settings.academyName) || 'IA'}</span><i /></div>
            <div><b>{settings.academyName}</b><small>BOOKINGS &amp; RENTALS</small></div>
          </Link>
          <nav className="bk-nav" aria-label="Booking site">
            <Link href="/book"><Warehouse size={16} /> <span>Facilities</span></Link>
            {booker ? (
              <>
                <Link href="/book/account" className="bk-bell"><CalendarCheck size={16} /> <span>My bookings</span>{unread > 0 && <em aria-label={`${unread} new messages`}>{unread}</em>}</Link>
                {booker.kind === 'FAMILY' && <Link href="/parent"><Smartphone size={16} /> <span>Parent app</span></Link>}
                <form action={bookingLogout}><button aria-label="Log out"><LogOut size={16} /> <span>Log out</span></button></form>
              </>
            ) : (
              <Link className="cta" href="/book/login"><LogIn size={16} /> <span>Log in</span></Link>
            )}
          </nav>
        </header>
        <main className="bk-main">{children}</main>
        <footer className="bk-footer">
          {settings.academyPhone && <a href={`tel:${settings.academyPhone.replace(/\s/g, '')}`}><Phone size={13} /> {settings.academyPhone}</a>}
          <span>{settings.academyName}{settings.academyAddress ? ` · ${settings.academyAddress}` : ''}</span>
        </footer>
      </div>
    </ToastProvider>
  );
}
