import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceDocument } from '@database/schemas/workspace.schema';
import { MongoObject, RepositoryRecord, toRecord } from './repository-record';

export type WorkspaceRecord = RepositoryRecord<Workspace>;

@Injectable()
export class WorkspacesRepository {
    constructor(
        @InjectModel(Workspace.name) private readonly workspaces: Model<WorkspaceDocument>
    ) {}

    async create(data: {
        name: string;
        slug: string;
        subdomain: string;
        ownerId: string;
    }): Promise<WorkspaceRecord> {
        const doc = await this.workspaces.create({
            ...data,
            status: 'active'
        });

        return toRecord(doc.toObject() as MongoObject<Workspace>);
    }

    async findById(id: string): Promise<WorkspaceRecord | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }

        const doc = await this.workspaces.findOne({ _id: id, ...this.activeFilter() }).lean();

        return doc ? toRecord(doc as MongoObject<Workspace>) : null;
    }

    async findBySlug(slug: string): Promise<WorkspaceRecord | null> {
        return this.findBySubdomain(slug);
    }

    async findBySubdomain(subdomain: string): Promise<WorkspaceRecord | null> {
        const doc = await this.workspaces
            .findOne({
                ...this.activeFilter(),
                $or: [{ subdomain }, { slug: subdomain }]
            })
            .lean();

        return doc ? toRecord(doc as MongoObject<Workspace>) : null;
    }

    async findByIds(ids: string[]): Promise<WorkspaceRecord[]> {
        const validIds = ids.filter((id) => Types.ObjectId.isValid(id));

        if (!validIds.length) {
            return [];
        }

        const docs = await this.workspaces
            .find({ _id: { $in: validIds }, ...this.activeFilter() })
            .lean();

        return (docs as unknown as MongoObject<Workspace>[]).map((doc) => toRecord(doc));
    }

    async existsBySlug(slug: string): Promise<boolean> {
        return this.existsBySubdomain(slug);
    }

    async existsBySubdomain(subdomain: string): Promise<boolean> {
        return Boolean(
            await this.workspaces.exists({
                $or: [{ subdomain }, { slug: subdomain }]
            })
        );
    }

    async softDelete(id: string, deletedByUserId: string): Promise<WorkspaceRecord | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }

        const doc = await this.workspaces.findOneAndUpdate(
            { _id: id, ...this.activeFilter() },
            {
                status: 'deleted',
                deletedAt: new Date(),
                deletedByUserId
            },
            { new: true }
        );

        return doc ? toRecord(doc.toObject() as MongoObject<Workspace>) : null;
    }

    private activeFilter() {
        return {
            status: { $ne: 'deleted' }
        };
    }
}
