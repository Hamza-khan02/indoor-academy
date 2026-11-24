import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runHousekeeping } from '@/lib/rentals/housekeeping';

export const dynamic = 'force-dynamic';

/**
 * Lets a scheduler (the host's cron) run the booking chores: release expired holds, send
 * reminders. Needs ?key=<CRON_SECRET>; switched off entirely when CRON_SECRET is not set.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return NextResponse.json({ error: 'Not enabled' }, { status: 404 });
  const key = new URL(req.url).searchParams.get('key') ?? '';
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  return NextResponse.json({ ok: true, ...(await runHousekeeping(true)) });
}

export const GET = handle;
export const POST = handle;
