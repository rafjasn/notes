import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
    MembershipRecord,
    WorkspacesRepository,
    MembershipsRepository,
    RolesRepository
} from '@database/repositories';
import { JwtUser } from '@modules/auth/auth.types';
import { PERMISSIONS } from './permissions.constants';
import { REQUIRED_PERMISSIONS } from './permissions.decorator';

interface WorkspaceScopedRequest {
    user?: JwtUser;
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
    workspaceId?: string;
    membership?: MembershipRecord;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly workspaces: WorkspacesRepository,
        private readonly memberships: MembershipsRepository,
        private readonly roles: RolesRepository
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
            context.getHandler(),
            context.getClass()
        ]);

        const request = context.switchToHttp().getRequest<WorkspaceScopedRequest>();
        const user = request.user;
        if (!user) throw new ForbiddenException('Authentication required');

        const workspaceId = this.getWorkspaceId(request);
        if (!workspaceId) throw new BadRequestException('Workspace context required');

        const workspace = await this.workspaces.findById(workspaceId);
        if (!workspace) throw new ForbiddenException('Workspace is not active');

        const membership = await this.memberships.findActiveByWorkspaceAndUser(
            workspaceId,
            user.userId
        );

        if (!membership) throw new ForbiddenException('Not a member of this workspace');

        request.workspaceId = workspaceId;
        request.membership = membership;

        if (!required?.length) return true;

        const roles = await this.roles.findByWorkspaceAndIds(workspaceId, membership.roleIds);
        const granted = new Set(roles.flatMap((role) => role.permissions));

        if (granted.has(PERMISSIONS.all)) return true;

        const allowed = required.every((permission) => granted.has(permission));
        if (!allowed) throw new ForbiddenException('Missing required permission');

        return true;
    }

    private getWorkspaceId(request: WorkspaceScopedRequest): string | undefined {
        const headerWorkspaceId = request.headers['x-workspace-id'];
        return (
            request.params?.workspaceId ||
            (typeof headerWorkspaceId === 'string' ? headerWorkspaceId : undefined) ||
            (typeof request.body?.workspaceId === 'string' ? request.body.workspaceId : undefined)
        );
    }
}
