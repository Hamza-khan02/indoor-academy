'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Banknote, Boxes, CalendarDays, FileBarChart, IndianRupee, LayoutDashboard, ListChecks, Settings, Target, Users, Warehouse } from 'lucide-react';

const TABS = [
  { href: '/bookings', label: 'Overview', icon: LayoutDashboard, need: 'view' },
  { href: '/bookings/list', label: 'Bookings', icon: ListChecks, need: 'view' },
  { href: '/bookings/calendar', label: 'Calendar', icon: CalendarDays, need: 'schedule' },
  { href: '/bookings/facilities', label: 'Facilities', icon: Warehouse, need: 'config' },
  { href: '/bookings/machines', label: 'Bowling machines', icon: Target, need: 'config' },
  { href: '/bookings/equipment', label: 'Equipment', icon: Boxes, need: 'config' },
  { href: '/bookings/pricing', label: 'Pricing', icon: IndianRupee, need: 'config' },
  { href: '/bookings/payments', label: 'Payments', icon: Banknote, need: 'refund' },
  { href: '/bookings/reports', label: 'Reports', icon: FileBarChart, need: 'reports' },
  { href: '/bookings/customers', label: 'Customers', icon: Users, need: 'config' },
  { href: '/bookings/settings', label: 'Settings', icon: Settings, need: 'config' },
];

/** The tab bar of the bookings section. `permissions` are the ones this staff member has. */
export function SubNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const active = (href: string) => (href === '/bookings' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  // Booking pages (/bookings/<id>, /bookings/new) belong to the "Bookings" tab.
  const known = TABS.some((t) => t.href !== '/bookings' && active(t.href));
  return (
    <nav className="rn-tabs" aria-label="Bookings section">
      {TABS.filter((t) => permissions.includes(t.need)).map((t) => (
        <Link key={t.href} href={t.href} className={active(t.href) || (t.href === '/bookings/list' && !known && pathname !== '/bookings') ? 'on' : undefined}>
          <t.icon size={15} /> {t.label}
        </Link>
      ))}
    </nav>
  );
}
