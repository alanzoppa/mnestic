import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'mnestic_session';
const AUTH_STATUS_PATH = '/api/auth/status';
const LOGIN_PATH = '/login';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never protect the login page, auth endpoints, or Next internals/static assets
  if (
    pathname === LOGIN_PATH ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/mnestic.png') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  // Auth disabled (enabled: false) => allow everything through.
  // No session cookie and auth enabled => redirect to login.
  if (!sessionCookie) {
    const enabled = await fetchAuthEnabled(request);
    if (enabled) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }
    return NextResponse.next();
  }

  // We have a session cookie but we can't verify its signature here (it is
  // signed with the backend secret). Instead we optimistically let the request
  // through. If the cookie is invalid, backend routes will return 401 and the
  // API client will redirect to /login.
  return NextResponse.next();
}

async function fetchAuthEnabled(request: NextRequest): Promise<boolean> {
  try {
    const apiUrl = new URL(AUTH_STATUS_PATH, request.url);
    const res = await fetch(apiUrl.toString(), {
      cache: 'no-store',
      credentials: 'include',
      headers: request.headers,
    });
    if (!res.ok) {
      // If we can't reach the auth endpoint, default to allowing access so the
      // app stays usable when the backend is temporarily down.
      return false;
    }
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled ?? true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|.*\\.(?:png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|css|js|json)$).*)',
  ],
};
