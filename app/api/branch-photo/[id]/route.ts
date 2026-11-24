import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getFamily } from '@/lib/family';

export const dynamic = 'force-dynamic';

/** A branch facility photo. Visible to staff and to any logged-in family. */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const allowed = Boolean(await getCurrentUser()) || Boolean(await getFamily());
  if (!allowed) return new NextResponse('Not found', { status: 404 });
  const photo = await db.branchPhoto.findUnique({ where: { id: params.id } });
  if (!photo) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(photo.data, {
    headers: {
      'Content-Type': photo.mimeType,
      'Cache-Control': 'private, max-age=31536000, immutable', // a photo never changes; a new one gets a new id
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
