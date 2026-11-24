import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { requireFamily } from '@/lib/family';
import { ensureReceiptNo } from '@/lib/receipts';
import { getSettings } from '@/lib/settings';
import { ReceiptView } from '@/components/ReceiptView';
import { PrintButton } from '@/app/receipt/[id]/PrintButton';

export default async function ParentReceiptPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const family = await requireFamily();
  const payment = await db.feePayment.findUnique({
    where: { id: params.id },
    include: { student: { include: { batch: { select: { name: true } }, branch: { select: { name: true } } } } },
  });
  // A family can only open receipts of its own children; anything else looks like "not found".
  if (!payment || payment.student.guardianPhoneKey !== family.login.phoneKey) notFound();
  const receiptNo = await ensureReceiptNo(payment);
  const settings = await getSettings();

  return (
    <div className="receipt-page portal-receipt">
      <div className="receipt-toolbar">
        <Link href={`/parent?child=${payment.studentId}`} className="secondary-btn"><ArrowLeft size={15} /> Back</Link>
        <PrintButton />
      </div>
      <ReceiptView receiptNo={receiptNo} settings={settings} payment={payment} />
    </div>
  );
}
