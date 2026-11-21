import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { currentMonth } from '@/lib/dates';
import { isValidMonth, loadMonthlyReport, reportWhatsappUrl } from '@/lib/report';
import { getSettings } from '@/lib/settings';
import { ReportView } from '@/components/ReportView';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { FormModal } from '@/components/FormModal';
import { saveProgressComment } from '@/app/(app)/progress/actions';
import { PrintButton } from '@/app/receipt/[id]/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Progress report' };

/** Printable monthly report for staff, with comment editing and WhatsApp send (toolbar hidden when printing). */
export default async function StaffReportPage({ params, searchParams }: { params: { id: string }; searchParams: { month?: string } }) {
  await requireUser();
  const month = isValidMonth(searchParams.month) ? searchParams.month : currentMonth();
  const [r, settings] = await Promise.all([loadMonthlyReport(params.id, month), getSettings()]);
  if (!r) notFound();
  return (
    <main className="receipt-page">
      <div className="receipt-toolbar">
        <Link href={`/progress?month=${month}`} className="secondary-btn"><ArrowLeft size={15} /> Progress reports</Link>
        <div className="receipt-toolbar-actions">
          <FormModal title={`Comment for ${r.student.name}`} eyebrow={r.monthLabel.toUpperCase()} trigger={<><Pencil size={14} /> {r.comment ? 'Edit comment' : 'Add comment'}</>} triggerClassName="secondary-btn" action={saveProgressComment.bind(null, r.student.id, month)} submitLabel="Save comment">
            <label>Coach&apos;s comment<textarea name="comment" rows={5} maxLength={1000} defaultValue={r.comment?.text ?? ''} /></label>
          </FormModal>
          <WhatsAppButton href={reportWhatsappUrl(r, settings.academyName, settings.publicUrl)} log={{ studentId: r.student.id, kind: 'REPORT', ref: month }} label="Send on WhatsApp" />
          <PrintButton />
        </div>
      </div>
      <ReportView r={r} academyName={settings.academyName} />
    </main>
  );
}
