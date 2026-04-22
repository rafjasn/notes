'use client';

import type { Note, NoteVersion } from '@/lib/types';

type EncryptedFields = Pick<
    Note,
    'content' | 'encrypted' | 'encryptedDataKey' | 'encryptedTitle' | 'iv' | 'title' | 'titleIv'
>;
type ByteArray = Uint8Array<ArrayBuffer>;

export function encryptionConfigured() {
    return Boolean(process.env.NEXT_PUBLIC_KMS_KEY_ID);
}

async function generateDataKey(
    workspaceId?: string
): Promise<{ plaintextKey: ByteArray; encryptedKey: string }> {
    const response = await fetch('/api/kms/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId })
    });

    if (!response.ok) {
        throw new Error('Failed to generate data key');
    }

    const data = (await response.json()) as { plaintextKey: string; encryptedKey: string };

    return { plaintextKey: base64ToBytes(data.plaintextKey), encryptedKey: data.encryptedKey };
}

async function decryptDataKey(encryptedKey: string, workspaceId?: string): Promise<ByteArray> {
    const response = await fetch('/api/kms/decrypt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ encryptedKey, workspaceId })
    });

    if (!response.ok) {
        throw new Error('Failed to decrypt data key');
    }

    const data = (await response.json()) as { plaintextKey: string };

    return base64ToBytes(data.plaintextKey);
}

function bytesToBase64(bytes: Uint8Array<ArrayBufferLike>) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
}

function base64ToBytes(value: string): ByteArray {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

async function importAesKey(keyBytes: ByteArray, usage: KeyUsage) {
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [usage]);
}

async function encryptString(value: string, key: CryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(value)
    );

    return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) };
}

async function decryptString(ciphertext: string, iv: string, key: CryptoKey) {
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(iv) },
        key,
        base64ToBytes(ciphertext)
    );

    return new TextDecoder().decode(plaintext);
}

export async function encryptNoteInput(
    input: { title: string; content: string },
    workspaceId?: string
): Promise<EncryptedFields> {
    if (!encryptionConfigured()) {
        return { title: input.title, content: input.content, encrypted: false };
    }

    const { plaintextKey, encryptedKey } = await generateDataKey(workspaceId);

    const keyBytes = plaintextKey;
    const cryptoKey = await importAesKey(keyBytes, 'encrypt');
    const [title, content] = await Promise.all([
        encryptString(input.title, cryptoKey),
        encryptString(input.content, cryptoKey)
    ]);

    keyBytes.fill(0);

    return {
        encrypted: true,
        encryptedDataKey: encryptedKey,
        encryptedTitle: title.ciphertext,
        titleIv: title.iv,
        content: content.ciphertext,
        iv: content.iv
    };
}

export async function decryptNote<T extends Note | NoteVersion>(
    note: T,
    workspaceId?: string
): Promise<T> {
    if (!note.encrypted || !note.encryptedDataKey) {
        return note;
    }

    try {
        const keyBytes = await decryptDataKey(note.encryptedDataKey, workspaceId);
        const cryptoKey = await importAesKey(keyBytes, 'decrypt');

        const [title, content] = await Promise.all([
            note.encryptedTitle && note.titleIv
                ? decryptString(note.encryptedTitle, note.titleIv, cryptoKey)
                : Promise.resolve(note.title),
            note.content && note.iv
                ? decryptString(note.content, note.iv, cryptoKey)
                : Promise.resolve(note.content)
        ]);

        keyBytes.fill(0);

        return { ...note, title: title ?? note.title, content: content ?? note.content };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to decrypt note';

        return {
            ...note,
            title: note.title ?? 'Encrypted note',
            content: note.content ?? '',
            encryptionError: message
        };
    }
}

export async function decryptNotes<T extends Note | NoteVersion>(
    notes: T[],
    workspaceId?: string
): Promise<T[]> {
    return Promise.all(notes.map((note) => decryptNote(note, workspaceId)));
}
