import { Shell } from '@/components/Shell';
import { requireStaff } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff(); // each page then checks what this role may open
  const [studentCount, branchCount] = await Promise.all([
    db.student.count({ where: { status: { not: 'INACTIVE' } } }),
    db.branch.count(),
  ]);
  return (
    <Shell user={{ name: user.name, role: user.role }} studentCount={studentCount} branchCount={branchCount}>
      {children}
    </Shell>
  );
}
