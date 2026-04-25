import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthChallengesRepository } from '@database/repositories';

@Injectable()
export class ChallengeStore {
    constructor(private readonly challenges: AuthChallengesRepository) {}

    generateId(): string {
        return randomBytes(32).toString('hex');
    }

    async set<T>(id: string, data: T, ttlSeconds: number): Promise<void> {
        await this.challenges.set(id, data, ttlSeconds);
    }

    async get<T>(id: string): Promise<T | null> {
        return this.challenges.get<T>(id);
    }

    async consume<T>(id: string): Promise<T | null> {
        return this.challenges.consume<T>(id);
    }
}
