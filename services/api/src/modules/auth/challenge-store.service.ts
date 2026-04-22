import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

interface Entry<T> {
    data: T;
    expiresAt: number;
}

@Injectable()
export class ChallengeStore {
    private readonly store = new Map<string, Entry<unknown>>();

    generateId(): string {
        return randomBytes(32).toString('hex');
    }

    set<T>(id: string, data: T, ttlSeconds: number): void {
        this.store.set(id, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    get<T>(id: string): T | null {
        const entry = this.store.get(id);

        if (!entry) return null;

        if (entry.expiresAt < Date.now()) {
            this.store.delete(id);
            return null;
        }

        return entry.data as T;
    }

    consume<T>(id: string): T | null {
        const value = this.get<T>(id);
        this.store.delete(id);
        return value;
    }
}
