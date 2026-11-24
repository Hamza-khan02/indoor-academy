import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireFamily } from '@/lib/family';
import { currentMonth, monthLabel } from '@/lib/dates';
import { isValidMonth, loadMonthlyReport, recentMonths } from '@/lib/report';
import { getSettings } from '@/lib/settings';
import { ReportView } from '@/components/ReportView';
import { Empty } from '@/components/ui';
import { PrintButton } from '@/app/receipt/[id]/PrintButton';

/** Parent app: monthly report for one of the family's own children. */
export default async function ParentReportPage(props: { searchParams: Promise<{ child?: string; month?: string }> }) {
  const searchParams = await props.searchParams;
  const family = await requireFamily();
  const child = family.students.find((s) => s.id === searchParams.child) ?? family.students[0];
  if (!child) return <article className="panel padded"><Empty title="No students linked to this phone number" /></article>;
  const month = isValidMonth(searchParams.month) ? searchParams.month : currentMonth();
  const [r, settings] = await Promise.all([loadMonthlyReport(child.id, month), getSettings()]);
  if (!r) return <article className="panel padded"><Empty title="Student not found" /></article>;
  return (
    <div className="receipt-page portal-receipt">
      <div className="receipt-toolbar">
        <Link href={`/parent?child=${child.id}`} className="secondary-btn"><ArrowLeft size={15} /> Back</Link>
        <div className="receipt-toolbar-actions month-tabs">
          {recentMonths(6).map((m) => (
            <Link key={m} href={`/parent/report?child=${child.id}&month=${m}`} className={m === month ? 'on' : ''}>{monthLabel(m)}</Link>
          ))}
          <PrintButton />
        </div>
      </div>
      <ReportView r={r} academyName={settings.academyName} />
    </div>
  );
}
