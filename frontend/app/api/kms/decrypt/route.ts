import { DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeWorkspaceKms,
    getAuthenticatedSession,
    setSessionCookies
} from '@/lib/server-api';

function kmsClient() {
    return new KMSClient({
        region: process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1',
        ...(process.env.NEXT_PUBLIC_KMS_ENDPOINT
            ? { endpoint: process.env.NEXT_PUBLIC_KMS_ENDPOINT }
            : {})
    });
}

export async function POST(request: NextRequest) {
    const session = await getAuthenticatedSession(request);

    if (!session) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken, claims, newTokens } = session;

    const body = (await request.json()) as { encryptedKey?: string; workspaceId?: string };

    if (!body.encryptedKey) {
        return NextResponse.json({ message: 'encryptedKey is required' }, { status: 400 });
    }

    const workspaceId = body.workspaceId ?? claims.workspaceId;

    if (!workspaceId) {
        return NextResponse.json({ message: 'workspaceId is required' }, { status: 400 });
    }

    const authorization = await authorizeWorkspaceKms(accessToken, workspaceId, 'decrypt');

    if (!authorization.ok) {
        const response = NextResponse.json(
            { message: 'Not authorized for workspace decryption' },
            { status: authorization.status }
        );

        if (newTokens) {
            setSessionCookies(response, newTokens);
        }

        return response;
    }

    const { Plaintext } = await kmsClient().send(
        new DecryptCommand({
            CiphertextBlob: Buffer.from(body.encryptedKey, 'base64'),
            EncryptionContext: { workspaceId }
        })
    );

    if (!Plaintext) {
        return NextResponse.json({ message: 'KMS returned no plaintext' }, { status: 502 });
    }

    const response = NextResponse.json({
        plaintextKey: Buffer.from(Plaintext).toString('base64')
    });

    if (newTokens) {
        setSessionCookies(response, newTokens);
    }

    return response;
}
