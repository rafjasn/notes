import { DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession, setSessionCookies } from '@/lib/server-api';

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

    const { claims, newTokens } = session;

    const body = (await request.json()) as { encryptedKey?: string; workspaceId?: string };

    if (!body.encryptedKey) {
        return NextResponse.json({ message: 'encryptedKey is required' }, { status: 400 });
    }

    const workspaceId = body.workspaceId ?? claims.workspaceId;

    const { Plaintext } = await kmsClient().send(
        new DecryptCommand({
            CiphertextBlob: Buffer.from(body.encryptedKey, 'base64'),
            ...(workspaceId ? { EncryptionContext: { workspaceId } } : {})
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
