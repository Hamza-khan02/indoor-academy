'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { inr } from '@/lib/format';

type Order = { orderId: string; keyId: string; amountPaise: number; code: string; name: string; phone: string; email: string | null };
type Started = { ok: true; order: Order } | { ok: false; error: string };
type Confirmed = { ok: true; state: 'PAID' | 'PROCESSING' | 'LATE' } | { ok: false; error: string };

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, fn: (r: any) => void) => void } }
}

function loadCheckout() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Opens Razorpay's checkout. When it closes, the result is sent to the server, which verifies
 * Razorpay's signature before the booking is treated as paid. The page never decides that itself.
 */
export function PayOnline({ bookingId, amount, academy, start, confirm }: {
  bookingId: string;
  amount: number;
  academy: string;
  start: (bookingId: string) => Promise<Started>;
  confirm: (data: { orderId: string; paymentId: string; signature: string }) => Promise<Confirmed>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function pay() {
    setBusy(true);
    setNote(null);
    try {
      const started = await start(bookingId);
      if ('error' in started) { setNote({ ok: false, text: started.error }); setBusy(false); return; }
      if (!(await loadCheckout()) || !window.Razorpay) { setNote({ ok: false, text: 'The payment window could not be loaded. Check your internet connection and try again.' }); setBusy(false); return; }
      const { order } = started;
      const checkout = new window.Razorpay({
        key: order.keyId, amount: order.amountPaise, currency: 'INR', order_id: order.orderId,
        name: academy, description: `Booking ${order.code}`,
        prefill: { name: order.name, contact: order.phone, email: order.email ?? undefined },
        theme: { color: '#ef4444' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const result = await confirm({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }).catch(() => null);
          if (!result) setNote({ ok: false, text: 'We could not check the payment just now. If money left your account it will show here shortly.' });
          else if ('error' in result) setNote({ ok: false, text: result.error });
          else if (result.state === 'PAID') setNote({ ok: true, text: 'Payment received. Thank you!' });
          else if (result.state === 'LATE') setNote({ ok: false, text: 'The payment arrived after the hold on this slot ran out. It will be refunded.' });
          else setNote({ ok: true, text: 'Your payment is being processed. This page will update when it is confirmed.' });
          setBusy(false);
          router.refresh();
        },
      });
      checkout.on('payment.failed', (r) => setNote({ ok: false, text: r?.error?.description || 'The payment did not go through. You can try again.' }));
      checkout.open();
    } catch {
      setNote({ ok: false, text: 'Could not start the payment. Please try again.' });
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="primary-btn" onClick={pay} disabled={busy}><CreditCard size={16} /> {busy ? 'Opening payment…' : `Pay ${inr(amount)} online`}</button>
      {note && <p className={`rn-note ${note.ok ? 'good' : 'bad'}`} role="status" style={{ width: '100%' }}>{note.text}</p>}
    </>
  );
}
