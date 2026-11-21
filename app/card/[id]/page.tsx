import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { loadCareer } from '@/lib/career';
import { getSettings } from '@/lib/settings';
import { CareerCard } from '@/components/career/CareerCard';
import { PrintButton } from '@/app/receipt/[id]/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Career card' };

/** Printable career card for staff (outside the sidebar layout so it prints cleanly). */
export default async function StaffCareerCard({ params }: { params: { id: string } }) {
  await requireUser();
  const [data, settings] = await Promise.all([loadCareer(params.id), getSettings()]);
  if (!data) notFound();
  return (
    <main className="receipt-page">
      <div className="receipt-toolbar">
        <Link href={`/students/${params.id}/career`} className="secondary-btn"><ArrowLeft size={15} /> Career stats</Link>
        <PrintButton />
      </div>
      <CareerCard data={data} academyName={settings.academyName} />
    </main>
  );
}
