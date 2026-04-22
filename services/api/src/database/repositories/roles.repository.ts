import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from '@database/schemas/role.schema';
import { MongoObject, RepositoryRecord, toRecord } from './repository-record';

export type RoleRecord = RepositoryRecord<Role>;

@Injectable()
export class RolesRepository {
    constructor(@InjectModel(Role.name) private readonly roles: Model<RoleDocument>) {}

    async create(data: {
        workspaceId: string;
        name: string;
        description?: string;
        permissions: string[];
        system: boolean;
    }): Promise<RoleRecord> {
        const doc = await this.roles.create(data);

        return toRecord(doc.toObject() as MongoObject<Role>);
    }

    async existsByWorkspaceAndName(workspaceId: string, name: string): Promise<boolean> {
        return Boolean(await this.roles.exists({ workspaceId, name }));
    }

    async findByWorkspace(workspaceId: string): Promise<RoleRecord[]> {
        const docs = await this.roles.find({ workspaceId }).sort({ system: -1, name: 1 }).lean();

        return (docs as unknown as MongoObject<Role>[]).map((doc) => toRecord(doc));
    }

    async findByWorkspaceAndIds(workspaceId: string, roleIds: string[]): Promise<RoleRecord[]> {
        const validRoleIds = roleIds.filter((roleId) => Types.ObjectId.isValid(roleId));

        if (!validRoleIds.length) {
            return [];
        }

        const docs = await this.roles.find({ workspaceId, _id: { $in: validRoleIds } }).lean();

        return (docs as unknown as MongoObject<Role>[]).map((doc) => toRecord(doc));
    }

    async countByWorkspaceAndIds(workspaceId: string, roleIds: string[]): Promise<number> {
        const validRoleIds = roleIds.filter((roleId) => Types.ObjectId.isValid(roleId));

        if (!validRoleIds.length) {
            return 0;
        }

        return this.roles.countDocuments({ workspaceId, _id: { $in: validRoleIds } });
    }
}
