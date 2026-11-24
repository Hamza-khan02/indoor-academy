import '../../rentals.css';
import { requireStaff } from '@/lib/auth';
import { ROLE_PERMISSIONS } from '@/lib/rentals/constants';
import { runHousekeeping } from '@/lib/rentals/housekeeping';
import { SubNav } from '@/components/rentals/SubNav';

export const dynamic = 'force-dynamic';

/** The bookings section: its tab bar, and the background chores (expired holds, reminders) kept up to date. */
export default async function BookingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  await runHousekeeping().catch((e) => console.error('Booking housekeeping failed', e));
  return (
    <>
      <SubNav permissions={ROLE_PERMISSIONS[user.role] ?? []} />
      {children}
    </>
  );
}
