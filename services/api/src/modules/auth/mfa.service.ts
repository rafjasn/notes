import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = '';

    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        out += ALPHABET[(value << (5 - bits)) & 31];
    }

    return out;
}

function base32Decode(str: string): Buffer {
    const s = str.replace(/=+$/, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const out: number[] = [];

    for (const ch of s) {
        const idx = ALPHABET.indexOf(ch);

        if (idx === -1) {
            continue;
        }

        value = (value << 5) | idx;
        bits += 5;

        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return Buffer.from(out);
}

function hotpCode(key: Buffer, counter: bigint, digits = 6): string {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(counter);

    const hmac = createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        (hmac[offset + 1] << 16) |
        (hmac[offset + 2] << 8) |
        hmac[offset + 3];

    return (code % 10 ** digits).toString().padStart(digits, '0');
}

@Injectable()
export class MfaService {
    generateSecret(): string {
        return base32Encode(randomBytes(20));
    }

    buildUri(secret: string, email: string, issuer: string): string {
        const params = new URLSearchParams({
            secret,
            issuer,
            algorithm: 'SHA1',
            digits: '6',
            period: '30'
        });

        return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params}`;
    }

    verify(secret: string, code: string, windowSteps = 1): boolean {
        const key = base32Decode(secret);
        const counter = BigInt(Math.floor(Date.now() / 1000 / 30));

        for (let i = -windowSteps; i <= windowSteps; i++) {
            if (hotpCode(key, counter + BigInt(i)) === code) {
                return true;
            }
        }

        return false;
    }
}
