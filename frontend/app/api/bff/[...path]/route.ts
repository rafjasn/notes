import { NextResponse, type NextRequest } from 'next/server';
import {
    bodyInit,
    createSessionFromBackend,
    createSessionOrChallenge,
    frontendRedirect,
    handleOAuthCallbackAndRedirect,
    logoutResponse,
    proxyAuthorizedJson,
    proxyPublicGet,
    proxyPublicJson,
    verifyMagicLinkAndRedirect
} from '@/lib/server-api';

const PUBLIC_POST_PATHS = new Set([
    '/auth/forgot-password',
    '/auth/magic-link',
    '/auth/otp/email',
    '/auth/otp/sms'
]);

const SESSION_OR_CHALLENGE_POST_PATHS = new Set([
    '/auth/login',
    '/auth/mfa/challenge',
    '/auth/otp/email/verify',
    '/auth/otp/sms/verify',
    '/auth/reset-password',
    '/auth/reset-password/mfa'
]);

function bffPath(path: string[]) {
    return '/' + path.join('/');
}

function upstreamPath(path: string[], request: NextRequest) {
    return '/' + path.map(encodeURIComponent).join('/') + request.nextUrl.search;
}

function isInvitationPreview(path: string[]) {
    return path.length === 3 && path[0] === 'invitations' && path[2] === 'preview';
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const pathname = bffPath(path);

    if (request.method === 'GET') {
        if (pathname === '/health') {
            return NextResponse.json({ status: 'ok' });
        }

        if (pathname === '/auth/magic-link/verify') {
            const token = request.nextUrl.searchParams.get('token');

            if (!token) {
                return frontendRedirect('/login?error=invalid_link', request.url);
            }

            return verifyMagicLinkAndRedirect(token, request.url);
        }

        if (pathname === '/auth/oauth/url') {
            const redirectUri = new URL('/api/bff/auth/oauth/callback', request.url).toString();

            return proxyPublicGet(`/auth/oauth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
        }

        if (pathname === '/auth/oauth/callback') {
            const code = request.nextUrl.searchParams.get('code');
            const state = request.nextUrl.searchParams.get('state');

            if (!code || !state) {
                return frontendRedirect('/login?error=oauth_failed', request.url);
            }

            const redirectUri = new URL('/api/bff/auth/oauth/callback', request.url).toString();

            return handleOAuthCallbackAndRedirect(code, state, redirectUri, request.url);
        }

        if (isInvitationPreview(path)) {
            return proxyPublicGet(`/invitations/${encodeURIComponent(path[1])}/preview`);
        }
    }

    if (request.method === 'POST') {
        if (pathname === '/auth/register') {
            return createSessionFromBackend(request, '/auth/register');
        }

        if (pathname === '/auth/logout') {
            return logoutResponse();
        }

        if (SESSION_OR_CHALLENGE_POST_PATHS.has(pathname)) {
            return createSessionOrChallenge(request, pathname);
        }

        if (PUBLIC_POST_PATHS.has(pathname)) {
            return proxyPublicJson(request, pathname);
        }
    }

    const apiPath = upstreamPath(path, request);
    const init: RequestInit = { method: request.method };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        Object.assign(init, await bodyInit(request));
    }

    return proxyAuthorizedJson(request, apiPath, init);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
