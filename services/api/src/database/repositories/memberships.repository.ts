import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Membership, MembershipDocument } from '@database/schemas/membership.schema';
import { MongoObject, RepositoryRecord, toRecord } from './repository-record';

export type MembershipRecord = RepositoryRecord<Membership>;

@Injectable()
export class MembershipsRepository {
    constructor(
        @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>
    ) {}

    async create(data: {
        workspaceId: string;
        userId: string;
        email: string;
        displayName: string;
        roleIds: string[];
    }): Promise<MembershipRecord> {
        const doc = await this.memberships.create(data);

        return toRecord(doc.toObject() as MongoObject<Membership>);
    }

    async activateOrCreate(data: {
        workspaceId: string;
        userId: string;
        email: string;
        displayName: string;
        roleIds: string[];
    }): Promise<MembershipRecord> {
        const doc = await this.memberships.findOneAndUpdate(
            { workspaceId: data.workspaceId, userId: data.userId },
            {
                $set: {
                    ...data,
                    status: 'active'
                },
                $unset: { leftAt: '' }
            },
            { upsert: true, new: true }
        );

        return toRecord(doc.toObject() as MongoObject<Membership>);
    }

    async findActiveByUser(userId: string): Promise<MembershipRecord[]> {
        const docs = await this.memberships.find({ userId, status: 'active' }).lean();

        return (docs as unknown as MongoObject<Membership>[]).map((doc) => toRecord(doc));
    }

    async findByWorkspace(workspaceId: string): Promise<MembershipRecord[]> {
        const docs = await this.memberships.find({ workspaceId }).lean();

        return (docs as unknown as MongoObject<Membership>[]).map((doc) => toRecord(doc));
    }

    async findActiveByWorkspace(workspaceId: string): Promise<MembershipRecord[]> {
        const docs = await this.memberships.find({ workspaceId, status: 'active' }).lean();

        return (docs as unknown as MongoObject<Membership>[]).map((doc) => toRecord(doc));
    }

    async findActiveByWorkspaceAndUser(
        workspaceId: string,
        userId: string
    ): Promise<MembershipRecord | null> {
        const doc = await this.memberships
            .findOne({ workspaceId, userId, status: 'active' })
            .lean();

        return doc ? toRecord(doc as MongoObject<Membership>) : null;
    }

    async existsActiveByWorkspaceAndEmail(workspaceId: string, email: string): Promise<boolean> {
        return Boolean(await this.memberships.exists({ workspaceId, email, status: 'active' }));
    }

    async existsActiveByWorkspaceAndUser(workspaceId: string, userId: string): Promise<boolean> {
        return Boolean(await this.memberships.exists({ workspaceId, userId, status: 'active' }));
    }

    async updateRoleIds(
        workspaceId: string,
        userId: string,
        roleIds: string[]
    ): Promise<MembershipRecord | null> {
        const doc = await this.memberships.findOneAndUpdate(
            { workspaceId, userId, status: 'active' },
            { roleIds },
            { new: true }
        );

        return doc ? toRecord(doc.toObject() as MongoObject<Membership>) : null;
    }

    async updateDisplayName(
        workspaceId: string,
        userId: string,
        displayName: string
    ): Promise<MembershipRecord | null> {
        const doc = await this.memberships.findOneAndUpdate(
            { workspaceId, userId, status: 'active' },
            { displayName },
            { new: true }
        );

        return doc ? toRecord(doc.toObject() as MongoObject<Membership>) : null;
    }

    async countActiveAdminsExcluding(
        workspaceId: string,
        adminRoleIds: string[],
        excludeUserId: string
    ): Promise<number> {
        return this.memberships.countDocuments({
            workspaceId,
            userId: { $ne: excludeUserId },
            status: 'active',
            roleIds: { $in: adminRoleIds }
        });
    }

    async markLeft(workspaceId: string, userId: string): Promise<void> {
        await this.memberships.updateOne(
            { workspaceId, userId, status: 'active' },
            {
                status: 'left',
                leftAt: new Date()
            }
        );
    }
}
