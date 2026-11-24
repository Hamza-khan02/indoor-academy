import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/rentals/constants';
import { buildReports, reportRange, toCsv } from '@/lib/rentals/reports';

export const dynamic = 'force-dynamic';

/** Booking reports as CSV files (they open in Excel). Only for staff who may see reports. */
export async function GET(req: Request, props: { params: Promise<{ type: string }> }) {
  const { type } = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  if (!can(user.role, 'reports')) return NextResponse.json({ error: 'Administrators only' }, { status: 403 });
  const url = new URL(req.url);
  const { from, to } = reportRange(url.searchParams.get('from') ?? undefined, url.searchParams.get('to') ?? undefined);
  const report = (await buildReports(from, to)).find((r) => r.key === type);
  if (!report) return NextResponse.json({ error: 'Unknown report' }, { status: 404 });
  return new NextResponse(toCsv(report), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="indoor-academy-bookings-${type}-${from}-to-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
