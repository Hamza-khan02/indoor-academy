import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getFamily } from '@/lib/family';

export const dynamic = 'force-dynamic';

/** A student's profile photo. Visible to staff, and to the student's own family in the parent app. */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  let allowed = Boolean(user) && user!.role !== 'RECEPTIONIST';
  if (!allowed) {
    const family = await getFamily();
    allowed = Boolean(family?.students.some((s) => s.id === params.id));
  }
  // Same answer for "not allowed" and "no photo", so nothing leaks about other students.
  if (!allowed) return new NextResponse('Not found', { status: 404 });

  const photo = await db.studentPhoto.findUnique({ where: { studentId: params.id } });
  if (!photo) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(photo.data, {
    headers: {
      'Content-Type': photo.mimeType,
      // The URL carries a version (?v=...), so the browser may keep it; "private" keeps it out of shared caches.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
