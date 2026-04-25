import { createHmac, createPublicKey, createVerify, timingSafeEqual, type KeyObject } from 'crypto';

export type AuthProvider = 'session' | 'keycloak' | 'cognito' | 'oidc';

export interface VerifyJwtOptions {
    provider: AuthProvider;
    jwtSecret?: string;
    issuer?: string;
    audience?: string;
    jwksUri?: string;
}

export interface VerifiedJwt {
    sub: string;
    email: string;
    claims: Record<string, unknown>;
    raw: string;
}

interface Jwk {
    kid?: string;
    kty: string;
    alg?: string;
    use?: string;
    n?: string;
    e?: string;
}

interface Jwks {
    keys: Jwk[];
}

const jwksCache = new Map<string, { expiresAt: number; keys: Map<string, KeyObject> }>();

function decodeBase64Url(input: string): Buffer {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

    return Buffer.from(padded, 'base64');
}

function encodeBase64Url(input: Buffer): string {
    return input.toString('base64url');
}

function decodeJsonPart(part: string): Record<string, unknown> {
    return JSON.parse(decodeBase64Url(part).toString('utf8')) as Record<string, unknown>;
}

function assertTimeClaims(claims: Record<string, unknown>) {
    const now = Math.floor(Date.now() / 1000);
    const exp = typeof claims.exp === 'number' ? claims.exp : undefined;
    const nbf = typeof claims.nbf === 'number' ? claims.nbf : undefined;

    if (exp && exp <= now) {
        throw new Error('Token expired');
    }

    if (nbf && nbf > now) {
        throw new Error('Token not active yet');
    }
}

function assertIssuer(claims: Record<string, unknown>, issuer?: string) {
    if (!issuer) {
        return;
    }

    if (claims.iss !== issuer) {
        throw new Error('Invalid token issuer');
    }
}

function assertAudience(claims: Record<string, unknown>, audience?: string) {
    if (!audience) {
        return;
    }

    const aud = claims.aud;
    const clientId = claims.client_id;
    const azp = claims.azp;

    if (Array.isArray(aud) && aud.includes(audience)) {
        return;
    }

    if (typeof aud === 'string' && aud === audience) {
        return;
    }

    if (typeof clientId === 'string' && clientId === audience) {
        return;
    }

    if (typeof azp === 'string' && azp === audience) {
        return;
    }

    throw new Error('Invalid token audience');
}

function emailFromClaims(claims: Record<string, unknown>): string {
    const email =
        claims.email ||
        claims.preferred_username ||
        claims.username ||
        claims['cognito:username'] ||
        claims.sub;

    if (typeof email !== 'string' || !email) {
        throw new Error('Token email missing');
    }

    return email;
}

function verifyHs256(token: string, secret: string): Record<string, unknown> {
    const parts = token.split('.');

    if (parts.length !== 3) {
        throw new Error('Malformed token');
    }

    const header = decodeJsonPart(parts[0]);
    if (header.alg !== 'HS256') {
        throw new Error('Unsupported token algorithm');
    }

    const signature = decodeBase64Url(parts[2]);
    const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();

    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
        throw new Error('Invalid token signature');
    }

    return decodeJsonPart(parts[1]);
}

async function getJwksKeys(jwksUri: string): Promise<Map<string, KeyObject>> {
    const cached = jwksCache.get(jwksUri);

    if (cached && cached.expiresAt > Date.now()) {
        return cached.keys;
    }

    const response = await fetch(jwksUri);

    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }

    const jwks = (await response.json()) as Jwks;
    const keys = new Map<string, KeyObject>();

    for (const jwk of jwks.keys) {
        if (jwk.kty !== 'RSA' || !jwk.kid) {
            continue;
        }

        keys.set(jwk.kid, createPublicKey({ key: jwk as any, format: 'jwk' }));
    }

    jwksCache.set(jwksUri, {
        expiresAt: Date.now() + 10 * 60 * 1000,
        keys
    });

    return keys;
}

async function verifyRs256(token: string, jwksUri: string): Promise<Record<string, unknown>> {
    const parts = token.split('.');

    if (parts.length !== 3) {
        throw new Error('Malformed token');
    }

    const header = decodeJsonPart(parts[0]);

    if (header.alg !== 'RS256') {
        throw new Error('Unsupported token algorithm');
    }

    if (typeof header.kid !== 'string') {
        throw new Error('Token kid missing');
    }

    const keys = await getJwksKeys(jwksUri);
    const key = keys.get(header.kid);

    if (!key) {
        throw new Error('JWKS key not found');
    }

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();

    const valid = verifier.verify(key, decodeBase64Url(parts[2]));

    if (!valid) {
        throw new Error('Invalid token signature');
    }

    return decodeJsonPart(parts[1]);
}

export async function verifyJwt(token: string, options: VerifyJwtOptions): Promise<VerifiedJwt> {
    const claims =
        options.provider === 'session'
            ? verifyHs256(token, options.jwtSecret ?? '')
            : await verifyRs256(token, options.jwksUri ?? '');

    if (typeof claims.sub !== 'string' || !claims.sub) {
        throw new Error('Token subject missing');
    }

    assertTimeClaims(claims);
    assertIssuer(claims, options.issuer);
    assertAudience(claims, options.audience);

    if (options.provider === 'session' && claims.type !== 'access') {
        throw new Error('Access token required');
    }

    return {
        sub: claims.sub,
        email: emailFromClaims(claims),
        claims,
        raw: token
    };
}

export function unsafeDecodeJwt(token: string): Record<string, unknown> {
    const parts = token.split('.');

    if (parts.length < 2) {
        throw new Error('Malformed token');
    }

    return decodeJsonPart(parts[1]);
}

export function signHs256ForTests(payload: Record<string, unknown>, secret: string): string {
    const header = encodeBase64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const body = encodeBase64Url(Buffer.from(JSON.stringify(payload)));
    const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest();

    return `${header}.${body}.${encodeBase64Url(signature)}`;
}
