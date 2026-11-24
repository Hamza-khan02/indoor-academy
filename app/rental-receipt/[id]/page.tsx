import '../../rentals.css';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getBooker, ownBookings } from '@/lib/rentals/account';
import { can } from '@/lib/rentals/constants';
import { getSettings } from '@/lib/settings';
import { PrintButton } from '@/app/receipt/[id]/PrintButton';
import { RentalReceipt } from '@/components/rentals/RentalReceipt';
import { parseLines } from '@/components/rentals/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Booking receipt' };

/**
 * Printable receipt of a booking. Open to staff who may see bookings, and to the customer or
 * family the booking belongs to. Anyone else gets "not found", whether or not the booking exists.
 */
export default async function RentalReceiptPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [user, booker] = await Promise.all([getCurrentUser(), getBooker()]);
  const staff = Boolean(user && can(user.role, 'view'));
  if (!staff && !booker) redirect(`/book/login?next=${encodeURIComponent(`/book/account/${id}`)}`);
  const [b, settings] = await Promise.all([
    db.rentalBooking.findFirst({
      where: staff ? { id } : { id, ...ownBookings(booker!) },
      include: {
        facility: { select: { name: true } }, package: { select: { name: true } },
        resources: { select: { resource: { select: { name: true } } } },
        payments: { where: { status: 'PAID' }, orderBy: { paidAt: 'asc' } },
        refunds: { where: { status: 'PROCESSED' }, orderBy: { processedAt: 'asc' } },
      },
    }),
    getSettings(),
  ]);
  if (!b) notFound();

  return (
    <main className="receipt-page">
      <div className="receipt-toolbar">
        <Link className="back-link" href={staff ? `/bookings/${b.id}` : `/book/account/${b.id}`} style={{ margin: 0 }}><ArrowLeft size={14} /> Back to the booking</Link>
        <div className="receipt-toolbar-actions"><PrintButton /></div>
      </div>
      <RentalReceipt
        academy={{ name: settings.academyName, address: settings.academyAddress, phone: settings.academyPhone, note: settings.receiptNote }}
        booking={{
          code: b.code, kind: b.kind, status: b.status, date: b.date, startMin: b.startMin, endMin: b.endMin, returnDate: b.returnDate,
          customerName: b.customerName, customerPhone: b.customerPhone, customerType: b.customerType,
          total: b.total, deposit: b.deposit, paid: b.paid,
          facility: b.facility.name, pkg: b.package?.name ?? null, units: b.resources.map((r) => r.resource.name), lines: parseLines(b.priceLines),
          payments: b.payments.map((p) => ({ receiptNo: p.receiptNo, amount: p.amount, method: p.method, reference: p.reference, paidAt: p.paidAt })),
          refunds: b.refunds.map((r) => ({ amount: r.amount, processedAt: r.processedAt, method: r.method })),
        }}
      />
    </main>
  );
}
