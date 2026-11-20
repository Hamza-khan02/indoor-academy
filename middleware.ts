import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/session';

// Every page needs a valid session except the login screen.
// Pages and actions also re-check the user against the database.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const onLogin = pathname === '/login';

  if (!session && !onLogin) {
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
