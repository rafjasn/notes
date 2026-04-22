import { createHmac, timingSafeEqual } from 'crypto';

export interface SessionClaims {
    sub: string;
    email: string;
    workspaceId?: string;
    type: string;
}

export function verifySessionToken(token: string): SessionClaims {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET not configured');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Malformed token');
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { alg?: string };

    if (header.alg !== 'HS256') {
        throw new Error('Unsupported algorithm');
    }

    const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2], 'base64url');

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw new Error('Invalid signature');
    }

    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as SessionClaims & {
        exp?: number;
    };

    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
    }

    if (claims.type !== 'access') {
        throw new Error('Access token required');
    }

    return claims;
}
