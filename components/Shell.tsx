'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, CalendarDays, CalendarRange, ChartNoAxesCombined, ChevronRight, CircleDollarSign, ClipboardCheck, LayoutDashboard,
  FileBarChart, ListChecks, LogOut, MapPin, Megaphone, Menu, Search, Settings, Swords, Trophy, UserRound, Users, X,
} from 'lucide-react';
import { logout } from '@/app/login/actions';
import { initials } from '@/lib/format';
import { USER_ROLES } from '@/lib/constants';
import { ToastProvider } from './Toast';

const WORKSPACE = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/coaches', label: 'Coaches', icon: UserRound },
  { href: '/batches', label: 'Batches & Sessions', icon: CalendarDays },
  { href: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { href: '/notices', label: 'Notices', icon: Megaphone },
  { href: '/fees', label: 'Fees & Finance', icon: CircleDollarSign, adminOnly: true },
  { href: '/performance', label: 'Performance', icon: ChartNoAxesCombined },
  { href: '/drills', label: 'Drills & homework', icon: ListChecks },
  { href: '/progress', label: 'Progress reports', icon: FileBarChart },
  { href: '/matches', label: 'Matches', icon: Swords },
  { href: '/tournaments', label: 'Tournaments', icon: Trophy },
];
const MANAGEMENT = [
  { href: '/branches', label: 'Branches', icon: MapPin, adminOnly: true },
  { href: '/reports', label: 'Reports & insights', icon: Activity, adminOnly: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

type Props = {
  user: { name: string; role: string };
  studentCount: number;
  branchCount: number;
  children: React.ReactNode;
};

export function Shell({ user, studentCount, branchCount, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const isAdmin = user.role === 'ADMIN';
  // A receptionist works the bookings desk only; a coach sees facility schedules.
  const deskOnly = user.role === 'RECEPTIONIST';
  const BOOKINGS = isAdmin || deskOnly
    ? [{ href: '/bookings', label: 'Bookings & rentals', icon: CalendarRange }]
    : [{ href: '/bookings/calendar', label: 'Facility schedule', icon: CalendarRange }];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
  const current = [...WORKSPACE, ...BOOKINGS, ...MANAGEMENT].find((n) => isActive(n.href));

  // Close the mobile menu after navigating.
  useEffect(() => setMobileOpen(false), [pathname]);

  // Ctrl+K / ⌘K focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/students?q=${encodeURIComponent(q)}` : '/students');
  }

  const navLink = (n: { href: string; label: string; icon: typeof CalendarRange; adminOnly?: boolean }) =>
    (!n.adminOnly || isAdmin) && (
      <Link key={n.href} href={n.href} className={`nav-item ${isActive(n.href) ? 'active' : ''}`}>
        <n.icon size={18} />
        <span>{n.label}</span>
        {n.href === '/students' && <em>{studentCount}</em>}
      </Link>
    );

  return (
    <ToastProvider>
      <main className="app-shell">
        <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
          <div className="brand">
            <div className="brand-mark"><span>IA</span><i /></div>
            <div>
              <b>INDOOR<span>ACADEMY</span></b>
              <small>CRICKET PERFORMANCE CENTER</small>
            </div>
            <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
          </div>
          <div className="branch-switch">
            <div className="branch-icon"><MapPin size={16} /></div>
            <div>
              <small>ACADEMY</small>
              <strong>{branchCount} {branchCount === 1 ? 'branch' : 'branches'}</strong>
            </div>
          </div>
          {!deskOnly && (
            <>
              <div className="nav-label">WORKSPACE</div>
              <nav>{WORKSPACE.map(navLink)}</nav>
            </>
          )}
          <div className={`nav-label${deskOnly ? '' : ' manage-label'}`}>BOOKINGS</div>
          <nav>{BOOKINGS.map(navLink)}</nav>
          <div className="nav-label manage-label">MANAGEMENT</div>
          <nav>{(deskOnly ? MANAGEMENT.filter((n) => n.href === '/settings') : MANAGEMENT).map(navLink)}</nav>
          <div className="sidebar-bottom">
            <div className="profile">
              <div className="avatar admin">{initials(user.name)}</div>
              <div className="profile-copy">
                <b>{user.name}</b>
                <small>{USER_ROLES[user.role] ?? user.role}</small>
              </div>
              <form action={logout}>
                <button className="icon-action" aria-label="Log out" title="Log out"><LogOut size={16} /></button>
              </form>
            </div>
          </div>
        </aside>
        {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}
        <section className="main-area">
          <header className="topbar">
            <button className="menu-button icon-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div className="crumb">Workspace <ChevronRight size={14} /> <b>{current?.label ?? 'Overview'}</b></div>
            <div className="top-actions">
              {!deskOnly && <form className="searchbox" onSubmit={onSearch} role="search">
                <Search size={16} />
                <input ref={searchRef} placeholder="Search students..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students" />
                <kbd>Ctrl K</kbd>
              </form>}
              <div className="top-avatar" title={user.name}>{initials(user.name)}</div>
            </div>
          </header>
          <div className="content">
            {children}
            <footer>
              <span>© {new Date().getFullYear()} INDOOR ACADEMY</span>
              <span>BUILT FOR THE NEXT GENERATION.</span>
            </footer>
          </div>
        </section>
      </main>
    </ToastProvider>
  );
}
