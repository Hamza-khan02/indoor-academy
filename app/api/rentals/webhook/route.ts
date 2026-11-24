import { NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/rentals/payments';

export const dynamic = 'force-dynamic';

/**
 * Razorpay calls this when a payment is captured, fails, or a refund is processed.
 * There is no login here: the request is trusted only if its body is signed with our webhook
 * secret, which is checked against the exact bytes received.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const result = await handleWebhook(raw, req.headers.get('x-razorpay-signature'));
  return NextResponse.json({ message: result.message }, { status: result.status });
}
