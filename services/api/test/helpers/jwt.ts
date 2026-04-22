import { signHs256ForTests } from '@notes/shared';

export const TEST_JWT_SECRET = 'notes-e2e-test-secret-not-for-production';

export interface TestTokenPayload {
    sub: string;
    email: string;
    workspaceId?: string;
    type?: 'access' | 'refresh';
    name?: string;
}

export function signTestToken(payload: TestTokenPayload, expiresInSeconds = 60 * 60): string {
    const now = Math.floor(Date.now() / 1000);

    return signHs256ForTests(
        {
            type: 'access',
            iat: now,
            exp: now + expiresInSeconds,
            ...payload
        },
        TEST_JWT_SECRET
    );
}

export function bearerToken(payload: TestTokenPayload): string {
    return `Bearer ${signTestToken(payload)}`;
}
