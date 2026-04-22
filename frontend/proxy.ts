import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'notes_access_token';
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/invite'];

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hasSession = request.cookies.has(ACCESS_COOKIE);

    const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

    if (isAuthPage) {
        if (hasSession) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return;
    }

    if (!hasSession) {
        return NextResponse.redirect(new URL('/login', request.url));
    }
}
