import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** A coach's profile photo. Public for active coaches (it is on the home page); staff can also see inactive coaches'. */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const photo = await db.coachPhoto.findUnique({ where: { coachId: params.id }, include: { coach: { select: { active: true } } } });
  if (!photo || (!photo.coach.active && !(await getCurrentUser()))) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(photo.data, {
    headers: {
      'Content-Type': photo.mimeType,
      // The URL carries a version (?v=...), so browsers may keep it.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
