import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireFamily } from '@/lib/family';
import { loadCareer } from '@/lib/career';
import { getSettings } from '@/lib/settings';
import { CareerCard } from '@/components/career/CareerCard';
import { Empty } from '@/components/ui';
import { PrintButton } from '@/app/receipt/[id]/PrintButton';

export default async function ParentCareerCard({ searchParams }: { searchParams: { child?: string } }) {
  const family = await requireFamily();
  const child = family.students.find((s) => s.id === searchParams.child) ?? family.students[0];
  if (!child) return <article className="panel padded"><Empty title="No students linked to this phone number" /></article>;
  const [data, settings] = await Promise.all([loadCareer(child.id), getSettings()]);
  if (!data) return <article className="panel padded"><Empty title="Student not found" /></article>;
  return (
    <div className="receipt-page portal-receipt">
      <div className="receipt-toolbar">
        <Link href={`/parent/career?child=${child.id}`} className="secondary-btn"><ArrowLeft size={15} /> Career stats</Link>
        <PrintButton />
      </div>
      <CareerCard data={data} academyName={settings.academyName} />
    </div>
  );
}
