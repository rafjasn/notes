import { GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms';
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

    const keyId = process.env.NEXT_PUBLIC_KMS_KEY_ID;

    if (!keyId) {
        return NextResponse.json({ message: 'KMS not configured' }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
    const workspaceId = body.workspaceId ?? claims.workspaceId;

    const { CiphertextBlob, Plaintext } = await kmsClient().send(
        new GenerateDataKeyCommand({
            KeyId: keyId,
            KeySpec: 'AES_256',
            ...(workspaceId ? { EncryptionContext: { workspaceId } } : {})
        })
    );

    if (!CiphertextBlob || !Plaintext) {
        return NextResponse.json({ message: 'KMS returned no key' }, { status: 502 });
    }

    const response = NextResponse.json({
        plaintextKey: Buffer.from(Plaintext).toString('base64'),
        encryptedKey: Buffer.from(CiphertextBlob).toString('base64')
    });

    if (newTokens) {
        setSessionCookies(response, newTokens);
    }

    return response;
}
