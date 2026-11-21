import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { loadCareer } from '@/lib/career';
import { CareerView } from '@/components/career/CareerView';

export default async function StudentCareerPage({ params }: { params: { id: string } }) {
  await requireUser();
  const data = await loadCareer(params.id);
  if (!data) notFound();
  return (
    <>
      <Link href={`/students/${params.id}`} className="back-link"><ArrowLeft size={14} /> {data.student.name}&apos;s profile</Link>
      <CareerView data={data} cardHref={`/card/${params.id}`} />
    </>
  );
}
