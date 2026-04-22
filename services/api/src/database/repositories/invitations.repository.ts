import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invitation, InvitationDocument } from '@database/schemas/invitation.schema';
import { MongoObject, RepositoryRecord, toRecord } from './repository-record';

export type InvitationRecord = RepositoryRecord<Invitation>;

@Injectable()
export class InvitationsRepository {
    constructor(
        @InjectModel(Invitation.name) private readonly invitations: Model<InvitationDocument>
    ) {}

    async create(data: {
        workspaceId: string;
        email: string;
        roleIds: string[];
        tokenHash: string;
        invitedByUserId: string;
        expiresAt: Date;
    }): Promise<InvitationRecord> {
        const doc = await this.invitations.create(data);

        return toRecord(doc.toObject() as MongoObject<Invitation>);
    }

    async findPendingByTokenHash(
        tokenHash: string,
        now = new Date()
    ): Promise<InvitationRecord | null> {
        const doc = await this.invitations
            .findOne({
                tokenHash,
                status: 'pending',
                expiresAt: { $gt: now }
            })
            .lean();

        return doc ? toRecord(doc as MongoObject<Invitation>) : null;
    }

    async existsPendingByWorkspaceAndEmail(
        workspaceId: string,
        email: string,
        now = new Date()
    ): Promise<boolean> {
        return Boolean(
            await this.invitations.exists({
                workspaceId,
                email,
                status: 'pending',
                expiresAt: { $gt: now }
            })
        );
    }

    async markAccepted(id: string, acceptedByUserId: string): Promise<void> {
        if (!Types.ObjectId.isValid(id)) {
            return;
        }

        await this.invitations.updateOne(
            { _id: id },
            {
                status: 'accepted',
                acceptedByUserId
            }
        );
    }
}
