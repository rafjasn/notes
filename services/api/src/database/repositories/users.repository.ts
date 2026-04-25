import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@database/schemas/user.schema';
import { MongoObject, RepositoryRecord, toRecord } from './repository-record';

export type UserRecord = RepositoryRecord<User>;

@Injectable()
export class UsersRepository {
    constructor(@InjectModel(User.name) private readonly users: Model<UserDocument>) {}

    async findByProviderId(providerId: string): Promise<UserRecord | null> {
        const doc = await this.users.findOne({ providerId }).lean();

        return doc ? toRecord(doc as MongoObject<User>) : null;
    }

    async findByEmail(email: string): Promise<UserRecord | null> {
        const doc = await this.users.findOne({ email: email.toLowerCase() }).lean();

        return doc ? toRecord(doc as MongoObject<User>) : null;
    }

    async findByPhone(phone: string): Promise<UserRecord | null> {
        const doc = await this.users.findOne({ phone: phone.replace(/\D/g, '') }).lean();

        return doc ? toRecord(doc as MongoObject<User>) : null;
    }

    async upsertFromProvider(input: {
        providerId: string;
        provider: 'keycloak' | 'cognito';
        email: string;
        name: string;
    }): Promise<UserRecord> {
        const doc = await this.users.findOneAndUpdate(
            {
                $or: [{ providerId: input.providerId }, { email: input.email }]
            },
            {
                $set: {
                    providerId: input.providerId,
                    provider: input.provider,
                    email: input.email,
                    name: input.name || input.email,
                    lastLoginAt: new Date()
                },
                $setOnInsert: {
                    status: 'active'
                }
            },
            { upsert: true, new: true }
        );

        return toRecord(doc.toObject() as MongoObject<User>);
    }

    async updateProfile(
        providerId: string,
        updates: { name?: string; phone?: string | null }
    ): Promise<UserRecord | null> {
        const normalized = {
            ...updates,
            ...(updates.phone != null ? { phone: updates.phone.replace(/\D/g, '') } : {})
        };
        const doc = await this.users.findOneAndUpdate(
            { providerId },
            { $set: normalized },
            { new: true }
        );

        return doc ? toRecord(doc.toObject() as MongoObject<User>) : null;
    }

    async touchLastLogin(providerId: string): Promise<void> {
        await this.users.updateOne({ providerId }, { lastLoginAt: new Date() });
    }

    async storePendingMfaSecret(providerId: string, secret: string): Promise<void> {
        await this.users.updateOne({ providerId }, { mfaPendingSecret: secret });
    }

    async activateMfa(providerId: string, secret: string): Promise<void> {
        await this.users.updateOne(
            { providerId },
            { mfaEnabled: true, mfaTotpSecret: secret, $unset: { mfaPendingSecret: '' } }
        );
    }

    async disableMfa(providerId: string): Promise<void> {
        await this.users.updateOne(
            { providerId },
            { mfaEnabled: false, $unset: { mfaTotpSecret: '', mfaPendingSecret: '' } }
        );
    }
}
