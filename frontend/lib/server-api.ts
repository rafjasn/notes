import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, type SessionClaims } from '@/lib/verify-session';

const ACCESS_COOKIE = 'notes_access_token';
const REFRESH_COOKIE = 'notes_refresh_token';

interface SessionTokens {
    accessToken: string;
    refreshToken: string;
}

type JsonObject = Record<string, unknown>;

function apiBaseUrl() {
    return (
        process.env.API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        'http://localhost/api'
    ).replace(/\/$/, '');
}

function apiUrl(path: string) {
    return `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function frontendBaseUrl(requestUrl: string) {
    return (
        process.env.FRONTEND_URL ??
        process.env.NEXT_PUBLIC_FRONTEND_URL ??
        new URL(requestUrl).origin
    ).replace(/\/$/, '');
}

export function frontendRedirect(path: string, requestUrl: string) {
    return NextResponse.redirect(new URL(path, frontendBaseUrl(requestUrl)));
}

function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, field: string) {
    return isJsonObject(value) && typeof value[field] === 'string' ? value[field] : undefined;
}

function extractSessionTokens(payload: unknown): SessionTokens | null {
    const accessToken = stringField(payload, 'accessToken');
    const refreshToken = stringField(payload, 'refreshToken');

    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

function publicPayload(payload: unknown) {
    if (!isJsonObject(payload)) return payload;

    const rest = { ...payload };
    delete rest.accessToken;
    delete rest.refreshToken;

    return rest;
}

async function parsePayload(response: Response) {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { message: text };
    }
}

function cookieOptions(maxAge: number) {
    const domain = process.env.AUTH_COOKIE_DOMAIN;

    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production' || process.env.AUTH_COOKIE_SECURE === 'true',
        path: '/',
        maxAge,
        ...(domain ? { domain } : {})
    };
}

export function setSessionCookies(response: NextResponse, tokens: SessionTokens) {
    response.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(15 * 60));
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(7 * 24 * 60 * 60));
}

export function clearSessionCookies(response: NextResponse) {
    response.cookies.set(ACCESS_COOKIE, '', cookieOptions(0));
    response.cookies.set(REFRESH_COOKIE, '', cookieOptions(0));
}

async function backendFetch(path: string, init: RequestInit, accessToken?: string) {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');

    if (init.body && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }

    if (accessToken) {
        headers.set('authorization', `Bearer ${accessToken}`);
    }

    return fetch(apiUrl(path), {
        ...init,
        headers,
        cache: 'no-store'
    });
}

async function refreshSession(refreshToken: string) {
    const response = await backendFetch('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
    });
    const payload = await parsePayload(response);

    if (!response.ok) return null;
    return extractSessionTokens(payload);
}

function jsonResponse(payload: unknown, status: number) {
    return NextResponse.json(payload ?? {}, { status });
}

export async function createSessionFromBackend(request: NextRequest, path: string) {
    const body = await request.text();
    const upstream = await backendFetch(path, {
        method: 'POST',
        body
    });
    const payload = await parsePayload(upstream);

    if (!upstream.ok) {
        return jsonResponse(payload ?? { message: 'Authentication failed' }, upstream.status);
    }

    const tokens = extractSessionTokens(payload);
    if (!tokens) {
        return jsonResponse(
            { message: 'Authentication response did not include session tokens' },
            502
        );
    }

    const response = jsonResponse(publicPayload(payload), upstream.status);
    setSessionCookies(response, tokens);
    return response;
}

export async function createSessionOrChallenge(request: NextRequest, path: string) {
    const body = await request.text();
    const upstream = await backendFetch(path, { method: 'POST', body });
    const payload = await parsePayload(upstream);

    if (!upstream.ok) {
        return jsonResponse(payload ?? { message: 'Authentication failed' }, upstream.status);
    }

    const tokens = extractSessionTokens(payload);
    if (tokens) {
        const response = jsonResponse(publicPayload(payload), upstream.status);
        setSessionCookies(response, tokens);
        return response;
    }

    if (isJsonObject(payload) && payload.requiresMfa) {
        return jsonResponse(payload, upstream.status);
    }

    return jsonResponse({ message: 'Authentication response missing tokens' }, 502);
}

export async function proxyPublicJson(request: NextRequest, path: string) {
    const body = await request.text();
    const upstream = await backendFetch(path, { method: 'POST', body });
    const payload = await parsePayload(upstream);
    return jsonResponse(payload ?? {}, upstream.status);
}

export async function proxyPublicGet(path: string) {
    const upstream = await backendFetch(path, { method: 'GET' });
    const payload = await parsePayload(upstream);
    return jsonResponse(payload ?? {}, upstream.status);
}

export async function verifyMagicLinkAndRedirect(token: string, baseUrl: string) {
    const redirectBaseUrl = frontendBaseUrl(baseUrl);
    const upstream = await backendFetch(
        `/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
        { method: 'GET' }
    );
    const payload = await parsePayload(upstream);

    if (!upstream.ok) {
        return NextResponse.redirect(new URL('/login?error=invalid_link', redirectBaseUrl));
    }

    const tokens = extractSessionTokens(payload);
    if (tokens) {
        const response = NextResponse.redirect(new URL('/', redirectBaseUrl));
        setSessionCookies(response, tokens);
        return response;
    }

    if (isJsonObject(payload) && payload.requiresMfa && typeof payload.challengeId === 'string') {
        return NextResponse.redirect(
            new URL(`/login?mfa=1&challengeId=${payload.challengeId}`, redirectBaseUrl)
        );
    }

    return NextResponse.redirect(new URL('/login?error=invalid_link', redirectBaseUrl));
}

export async function handleOAuthCallbackAndRedirect(
    code: string,
    state: string,
    redirectUri: string,
    baseUrl: string
) {
    const redirectBaseUrl = frontendBaseUrl(baseUrl);
    const upstream = await backendFetch(
        `/auth/oauth/callback?redirectUri=${encodeURIComponent(redirectUri)}`,
        { method: 'POST', body: JSON.stringify({ code, state }) }
    );
    const payload = await parsePayload(upstream);

    if (!upstream.ok) {
        return NextResponse.redirect(new URL('/login?error=oauth_failed', redirectBaseUrl));
    }

    const tokens = extractSessionTokens(payload);

    if (tokens) {
        const response = NextResponse.redirect(new URL('/', redirectBaseUrl));
        setSessionCookies(response, tokens);
        return response;
    }

    if (isJsonObject(payload) && payload.requiresMfa && typeof payload.challengeId === 'string') {
        return NextResponse.redirect(
            new URL(`/login?mfa=1&challengeId=${payload.challengeId}`, redirectBaseUrl)
        );
    }

    return NextResponse.redirect(new URL('/login?error=oauth_failed', redirectBaseUrl));
}

export function logoutResponse() {
    const response = NextResponse.json({ loggedOut: true });
    clearSessionCookies(response);

    return response;
}

export async function getAuthenticatedSession(
    request: NextRequest
): Promise<{ accessToken: string; claims: SessionClaims; newTokens: SessionTokens | null } | null> {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

    if (!accessToken) {
        return null;
    }

    try {
        const claims = verifySessionToken(accessToken);

        return { accessToken, claims, newTokens: null };
    } catch {
        if (!refreshToken) {
            return null;
        }
        const newTokens = await refreshSession(refreshToken);
        if (!newTokens) {
            return null;
        }
        try {
            const claims = verifySessionToken(newTokens.accessToken);

            return { accessToken: newTokens.accessToken, claims, newTokens };
        } catch {
            return null;
        }
    }
}

export async function authorizeWorkspaceKms(
    accessToken: string,
    workspaceId: string,
    operation: 'generate' | 'decrypt'
): Promise<Response> {
    return backendFetch(
        `/workspaces/${encodeURIComponent(workspaceId)}/kms/authorize`,
        {
            method: 'POST',
            body: JSON.stringify({ operation })
        },
        accessToken
    );
}

export async function proxyAuthorizedJson(
    request: NextRequest,
    path: string,
    init: RequestInit = {}
) {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

    if (!accessToken) {
        const response = jsonResponse({ message: 'Authentication required' }, 401);
        clearSessionCookies(response);

        return response;
    }

    let nextTokens: SessionTokens | null = null;
    let upstream = await backendFetch(path, init, accessToken);
    let payload = await parsePayload(upstream);

    if (upstream.status === 401 && refreshToken) {
        nextTokens = await refreshSession(refreshToken);

        if (nextTokens) {
            upstream = await backendFetch(path, init, nextTokens.accessToken);
            payload = await parsePayload(upstream);
        }
    }

    const response = jsonResponse(payload, upstream.status);

    if (nextTokens) {
        setSessionCookies(response, nextTokens);
    }

    if (upstream.status === 401) {
        clearSessionCookies(response);
    }

    return response;
}

export async function bodyInit(request: NextRequest): Promise<RequestInit> {
    const body = await request.text();

    return body ? { body } : {};
}
