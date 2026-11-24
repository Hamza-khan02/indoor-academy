import { NextResponse, type NextRequest } from 'next/server';
import { PARENT_COOKIE, SESSION_COOKIE, verifyParentSession, verifySession } from './lib/session';

// Three areas:
//  - /home, /home/...  the public home page and coach pages (no login). Logged-out visitors also get the home page at "/".
//  - /parent/...  the parent / student app (needs a parent login, except /parent/login)
//  - everything else  the staff app (needs a staff login, except /login)
// Pages and actions also re-check the session against the database.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Public pages, and coach photos shown on them (the photo route only serves active coaches to visitors).
  if (pathname === '/home' || pathname.startsWith('/home/') || pathname.startsWith('/api/coach-photo/')) return NextResponse.next();

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

  // Student photos are shown in both apps; the route itself checks who may see which photo.
  if (pathname.startsWith('/api/photo/') || pathname.startsWith('/api/branch-photo/')) {
    const parentToken = req.cookies.get(PARENT_COOKIE)?.value;
    if (session || (parentToken && (await verifyParentSession(parentToken)))) return NextResponse.next();
    return new NextResponse('Not found', { status: 404 });
  }
  // "/" is the staff dashboard when logged in and the public home page otherwise (the address stays "/").
  if (!session && pathname === '/') return NextResponse.rewrite(new URL('/home', req.url));
  if (!session && pathname !== '/login') {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  // Logged-in visitors on /login are redirected by the login page itself, after it
  // confirms the user still exists (avoids a loop for deleted users with old cookies).
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
