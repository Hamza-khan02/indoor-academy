import { NextResponse, type NextRequest } from 'next/server';
import { PARENT_COOKIE, SESSION_COOKIE, verifyParentSession, verifySession } from './lib/session';

// Two separate areas:
//  - /parent/...  the parent / student app (needs a parent login, except /parent/login)
//  - everything else  the staff app (needs a staff login, except /login)
// Pages and actions also re-check the session against the database.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === '/parent' || pathname.startsWith('/parent/')) {
    if (pathname === '/parent/login') return NextResponse.next();
    const token = req.cookies.get(PARENT_COOKIE)?.value;
    if (!token || !(await verifyParentSession(token))) {
      return NextResponse.redirect(new URL('/parent/login', req.url));
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session && pathname !== '/login') {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  // Logged-in visitors on /login are redirected by the login page itself, after it
  // confirms the user still exists (avoids a loop for deleted users with old cookies).
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
