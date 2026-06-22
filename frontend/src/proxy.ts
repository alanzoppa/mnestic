import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'mnestic_session';
const AUTH_STATUS_ROUTE = '/api/auth/status';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never gate public/static assets or the login page itself.
  if (
    pathname === '/login' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/static/') ||
    /\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|json|woff|woff2|ttf|otf)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // If auth is disabled, let everything through.
  try {
    const statusRes = await fetch(new URL(AUTH_STATUS_ROUTE, request.url), {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (statusRes.ok) {
      const status = (await statusRes.json()) as { enabled?: boolean; authenticated?: boolean };
      if (status.enabled === false) {
        return NextResponse.next();
      }
      if (status.authenticated === true) {
        return NextResponse.next();
      }
    }
  } catch {
    // On error, fall through to the safest behavior: require login if a session cookie is not present.
  }

  // Check for a session cookie as a fast fallback / local check.
  if (request.cookies.has(COOKIE_NAME)) {
    return NextResponse.next();
  }

  // Otherwise redirect to login, preserving the original path so we can return after login.
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: '/((?!_next|api|static|.*\\.).*)',
};
