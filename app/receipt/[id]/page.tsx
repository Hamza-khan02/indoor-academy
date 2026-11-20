import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth';
import { ensureReceiptNo } from '@/lib/receipts';
import { getSettings, receiptMessageUrl } from '@/lib/settings';
import { ReceiptView } from '@/components/ReceiptView';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const p = await db.feePayment.findUnique({ where: { id: params.id }, select: { receiptNo: true, student: { select: { name: true } } } });
  return { title: p ? `Receipt ${p.receiptNo ?? ''} – ${p.student.name}` : 'Receipt' };
}

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  await requireAdminPage();
  const payment = await db.feePayment.findUnique({
    where: { id: params.id },
    include: { student: { include: { batch: { select: { name: true } }, branch: { select: { name: true } } } } },
  });
  if (!payment) notFound();
  const receiptNo = await ensureReceiptNo(payment);
  const settings = await getSettings();
  const s = payment.student;

  return (
    <main className="receipt-page">
      <div className="receipt-toolbar">
        <Link href={`/students/${s.id}`} className="secondary-btn"><ArrowLeft size={15} /> {s.name}</Link>
        <div className="receipt-toolbar-actions">
          <WhatsAppButton
            href={receiptMessageUrl(settings, { ...s, batchName: s.batch?.name }, { ...payment, receiptNo })}
            log={{ studentId: s.id, kind: 'RECEIPT', ref: payment.id }}
            label="Send on WhatsApp"
          />
          <PrintButton />
        </div>
      </div>
      <ReceiptView receiptNo={receiptNo} settings={settings} payment={payment} />
    </main>
  );
}
