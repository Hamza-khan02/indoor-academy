import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireFamily } from '@/lib/family';
import { loadCareer } from '@/lib/career';
import { CareerView } from '@/components/career/CareerView';
import { Empty } from '@/components/ui';

export default async function ParentCareerPage(props: { searchParams: Promise<{ child?: string }> }) {
  const searchParams = await props.searchParams;
  const family = await requireFamily();
  // Only the family's own children can be opened.
  const child = family.students.find((s) => s.id === searchParams.child) ?? family.students[0];
  if (!child) return <article className="panel padded"><Empty title="No students linked to this phone number" /></article>;
  const data = await loadCareer(child.id);
  if (!data) return <article className="panel padded"><Empty title="Student not found" /></article>;
  return (
    <>
      <Link href={`/parent?child=${child.id}`} className="back-link"><ArrowLeft size={14} /> Back</Link>
      <CareerView data={data} cardHref={`/parent/card?child=${child.id}`} />
    </>
  );
}
