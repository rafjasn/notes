import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthChallenge, AuthChallengeDocument } from '@database/schemas/auth-challenge.schema';

@Injectable()
export class AuthChallengesRepository {
    constructor(
        @InjectModel(AuthChallenge.name)
        private readonly challenges: Model<AuthChallengeDocument>
    ) {}

    async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
        await this.challenges.updateOne(
            { key },
            {
                $set: {
                    key,
                    data,
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000)
                }
            },
            { upsert: true }
        );
    }

    async get<T>(key: string, now = new Date()): Promise<T | null> {
        const doc = await this.challenges.findOne({ key, expiresAt: { $gt: now } }).lean();

        return doc ? (doc.data as T) : null;
    }

    async consume<T>(key: string, now = new Date()): Promise<T | null> {
        const doc = await this.challenges.findOneAndDelete({ key, expiresAt: { $gt: now } }).lean();

        return doc ? (doc.data as T) : null;
    }
}
