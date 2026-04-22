import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FanoutClient } from '@notes/fanout-client';
import { parseChannel } from '@notes/shared';
import {
    WorkspacesRepository,
    MembershipsRepository,
    RolesRepository
} from '@database/repositories';
import { PERMISSIONS } from '@modules/workspaces/permissions.constants';
import { JwtUser } from '@modules/auth/auth.types';

const TOPIC_PERMISSIONS: Record<string, string> = {
    notes: PERMISSIONS.notesRead
};

function staticAwsCredentials() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        return {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };
    }

    if (process.env.NODE_ENV !== 'production' && process.env.AWS_ENDPOINT) {
        return {
            accessKeyId: 'test',
            secretAccessKey: 'test'
        };
    }

    return undefined;
}

@Injectable()
export class RealtimeService {
    private readonly fanout: FanoutClient;

    constructor(
        private readonly workspaces: WorkspacesRepository,
        private readonly memberships: MembershipsRepository,
        private readonly roles: RolesRepository,
        private readonly config: ConfigService
    ) {
        this.fanout = new FanoutClient({
            topicArn: config.get<string>('app.aws.snsTopicArn')!,
            region: config.get<string>('app.aws.region'),
            endpoint: config.get<string>('app.aws.endpoint'),
            credentials: staticAwsCredentials()
        });
    }

    async authorizeChannel(user: JwtUser, channel: string) {
        const parsed = parseChannel(channel);

        if (parsed.scope === 'public') {
            return { allowed: true, channel };
        }

        if (parsed.scope === 'private-user') {
            if (parsed.userId !== user.userId) {
                throw new ForbiddenException('Cannot subscribe to another user');
            }

            return { allowed: true, channel };
        }

        if (parsed.scope === 'private-workspace' || parsed.scope === 'presence-workspace') {
            if (!parsed.workspaceId) {
                throw new ForbiddenException('Workspace channel is missing a workspace id');
            }

            const workspace = await this.workspaces.findById(parsed.workspaceId);
            if (!workspace) {
                throw new ForbiddenException('Workspace is not active');
            }

            const membership = await this.memberships.findActiveByWorkspaceAndUser(
                parsed.workspaceId,
                user.userId
            );

            if (!membership) {
                throw new ForbiddenException('Not a member of this workspace');
            }

            const requiredPermission = TOPIC_PERMISSIONS[parsed.topic];
            if (requiredPermission) {
                const memberRoles = await this.roles.findByWorkspaceAndIds(
                    parsed.workspaceId,
                    membership.roleIds
                );

                const hasPermission = memberRoles.some(
                    (role) =>
                        role.permissions.includes(PERMISSIONS.all) ||
                        role.permissions.includes(requiredPermission)
                );

                if (!hasPermission) {
                    throw new ForbiddenException('Insufficient permissions for this channel');
                }
            }

            return {
                allowed: true,
                channel,
                workspaceId: parsed.workspaceId,
                roleIds: membership.roleIds
            };
        }

        throw new ForbiddenException('Unsupported channel');
    }

    async trigger(channel: string, event: string, payload: unknown) {
        parseChannel(channel);
        await this.fanout.trigger(channel, event, payload);

        return { queued: true, channel, event };
    }
}
