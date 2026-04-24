import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import {
    WorkspacesRepository,
    WorkspaceRecord,
    InvitationsRepository,
    MembershipRecord,
    MembershipsRepository,
    RoleRecord,
    RolesRepository,
    UsersRepository
} from '@database/repositories';
import { JwtUser } from '@modules/auth/auth.types';
import { MailService } from '@modules/mail/mail.service';
import {
    AcceptInvitationDto,
    CreateWorkspaceDto,
    CreateRoleDto,
    InviteUserDto,
    UpdateMemberRolesDto,
    UpdateMyWorkspaceProfileDto
} from './workspaces.dto';
import { DEFAULT_MEMBER_PERMISSIONS, PERMISSIONS } from './permissions.constants';
import {
    appendWorkspaceSubdomainSuffix,
    workspaceSubdomainValidationError,
    generatedWorkspaceSubdomainBase,
    normalizeWorkspaceSubdomain
} from './subdomain';

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class WorkspacesService {
    constructor(
        private readonly workspaces: WorkspacesRepository,
        private readonly roles: RolesRepository,
        private readonly memberships: MembershipsRepository,
        private readonly invitations: InvitationsRepository,
        private readonly users: UsersRepository,
        private readonly mail: MailService,
        private readonly config: ConfigService
    ) {}

    async createWorkspace(dto: CreateWorkspaceDto, user: JwtUser) {
        const subdomain = await this.prepareSubdomain(dto.subdomain, dto.name);
        const displayName = await this.defaultDisplayName(user, dto.displayName);
        let workspace: WorkspaceRecord;

        try {
            workspace = await this.workspaces.create({
                name: dto.name.trim(),
                slug: subdomain,
                subdomain,
                ownerId: user.userId
            });
        } catch (error) {
            if (this.isDuplicateKeyError(error)) {
                throw new ConflictException('A workspace with this subdomain already exists');
            }

            throw error;
        }

        const adminRole = await this.roles.create({
            workspaceId: workspace.id,
            name: 'Admin',
            description: 'Full workspace administration',
            permissions: [PERMISSIONS.all],
            system: true
        });

        await this.roles.create({
            workspaceId: workspace.id,
            name: 'Member',
            description: 'Default product access',
            permissions: DEFAULT_MEMBER_PERMISSIONS,
            system: true
        });

        await this.roles.create({
            workspaceId: workspace.id,
            name: 'Deleted Notes Viewer',
            description: 'Can read notes that were moved to trash',
            permissions: [PERMISSIONS.notesRead, PERMISSIONS.notesReadDeleted],
            system: true
        });

        await this.roles.create({
            workspaceId: workspace.id,
            name: 'Note History Viewer',
            description: 'Can read previous note versions',
            permissions: [PERMISSIONS.notesRead, PERMISSIONS.notesVersionsRead],
            system: true
        });

        await this.memberships.create({
            workspaceId: workspace.id,
            userId: user.userId,
            email: user.email,
            displayName,
            roleIds: [adminRole.id]
        });

        return this.workspaceDto(workspace);
    }

    async resolveBySubdomain(input: string, user: JwtUser) {
        const subdomain = normalizeWorkspaceSubdomain(input);
        const validationError = workspaceSubdomainValidationError(subdomain);

        if (validationError) {
            throw new BadRequestException(validationError);
        }

        const workspace = await this.workspaces.findBySubdomain(subdomain);

        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        const membership = await this.memberships.findActiveByWorkspaceAndUser(
            workspace.id,
            user.userId
        );

        if (!membership) {
            throw new ForbiddenException('Not a member of this workspace');
        }

        return {
            workspace: this.workspaceDto(workspace),
            membership: this.membershipDto(membership)
        };
    }

    async listMyWorkspaces(user: JwtUser) {
        const memberships = await this.memberships.findActiveByUser(user.userId);
        const workspaceIds = memberships.map((membership) => membership.workspaceId);
        const workspaces = await this.workspaces.findByIds(workspaceIds);
        const workspacesById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));

        return memberships.map((membership) => ({
            membershipId: membership.id,
            displayName: membership.displayName || membership.email,
            roleIds: membership.roleIds,
            workspace: this.workspaceDto(workspacesById.get(membership.workspaceId))
        }));
    }

    async listMembers(workspaceId: string) {
        const [memberships, roles] = await Promise.all([
            this.memberships.findByWorkspace(workspaceId),
            this.roles.findByWorkspace(workspaceId)
        ]);

        const rolesById = new Map(roles.map((role) => [role.id, this.roleDto(role)]));

        return memberships.map((membership) => ({
            membershipId: membership.id,
            userId: membership.userId,
            email: membership.email,
            displayName: membership.displayName || membership.email,
            status: membership.status,
            roles: membership.roleIds.map((roleId) => rolesById.get(roleId)).filter(Boolean)
        }));
    }

    async listRoles(workspaceId: string) {
        const roles = await this.roles.findByWorkspace(workspaceId);
        return roles.map((role) => this.roleDto(role));
    }

    async createRole(workspaceId: string, dto: CreateRoleDto) {
        const existing = await this.roles.existsByWorkspaceAndName(workspaceId, dto.name.trim());

        if (existing) {
            throw new ConflictException('A role with this name already exists');
        }

        const role = await this.roles.create({
            workspaceId,
            name: dto.name.trim(),
            description: dto.description?.trim(),
            permissions: dto.permissions,
            system: false
        });

        return this.roleDto(role);
    }

    async updateMemberRoles(workspaceId: string, userId: string, dto: UpdateMemberRolesDto) {
        await this.ensureRolesBelongToWorkspace(workspaceId, dto.roleIds);

        const membership = await this.memberships.findActiveByWorkspaceAndUser(workspaceId, userId);

        if (!membership) {
            throw new NotFoundException('Member not found');
        }

        await this.ensureRoleChangeKeepsAdmin(workspaceId, membership, dto.roleIds);

        const updated = await this.memberships.updateRoleIds(workspaceId, userId, dto.roleIds);

        if (!updated) {
            throw new NotFoundException('Member not found');
        }

        return {
            membershipId: updated.id,
            userId: updated.userId,
            email: updated.email,
            displayName: updated.displayName || updated.email,
            roleIds: updated.roleIds
        };
    }

    async authorizeKms(
        workspaceId: string,
        user: JwtUser,
        operation: 'generate' | 'decrypt'
    ): Promise<{ allowed: true; workspaceId: string; operation: 'generate' | 'decrypt' }> {
        const workspace = await this.workspaces.findById(workspaceId);

        if (!workspace) {
            throw new ForbiddenException('Workspace is not active');
        }

        const membership = await this.memberships.findActiveByWorkspaceAndUser(
            workspaceId,
            user.userId
        );

        if (!membership) {
            throw new ForbiddenException('Not a member of this workspace');
        }

        const requiredPermission =
            operation === 'generate' ? PERMISSIONS.notesWrite : PERMISSIONS.notesRead;
        const roles = await this.roles.findByWorkspaceAndIds(workspaceId, membership.roleIds);
        const hasPermission = roles.some(
            (role) =>
                role.permissions.includes(PERMISSIONS.all) ||
                role.permissions.includes(requiredPermission)
        );

        if (!hasPermission) {
            throw new ForbiddenException('Insufficient permissions for this KMS operation');
        }

        return { allowed: true, workspaceId, operation };
    }

    async updateMyWorkspaceProfile(
        workspaceId: string,
        user: JwtUser,
        dto: UpdateMyWorkspaceProfileDto
    ) {
        const membership = await this.memberships.updateDisplayName(
            workspaceId,
            user.userId,
            dto.displayName.trim()
        );

        if (!membership) {
            throw new NotFoundException('Membership not found');
        }

        return this.membershipDto(membership);
    }

    async leaveWorkspace(workspaceId: string, user: JwtUser) {
        const membership = await this.memberships.findActiveByWorkspaceAndUser(
            workspaceId,
            user.userId
        );

        if (!membership) {
            throw new NotFoundException('Membership not found');
        }

        const adminRoleIds = await this.adminRoleIds(workspaceId);

        if (this.hasAdminRole(membership.roleIds, adminRoleIds)) {
            const remainingAdmins = await this.memberships.countActiveAdminsExcluding(
                workspaceId,
                [...adminRoleIds],
                user.userId
            );

            if (remainingAdmins === 0) {
                throw new ForbiddenException(
                    'You are the last admin. Promote another member to admin or delete the workspace before leaving.'
                );
            }
        }

        await this.memberships.markLeft(workspaceId, user.userId);

        return { left: true, workspaceId };
    }

    async deleteWorkspace(workspaceId: string, user: JwtUser) {
        const deleted = await this.workspaces.softDelete(workspaceId, user.userId);

        if (!deleted) {
            throw new NotFoundException('Workspace not found');
        }

        return {
            deleted: true,
            workspace: this.workspaceDto(deleted)
        };
    }

    async inviteUser(workspaceId: string, dto: InviteUserDto, invitedBy: JwtUser) {
        await this.ensureRolesBelongToWorkspace(workspaceId, dto.roleIds);

        const workspace = await this.workspaces.findById(workspaceId);

        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        const email = normalizeEmail(dto.email);
        const existingMember = await this.memberships.existsActiveByWorkspaceAndEmail(
            workspaceId,
            email
        );

        if (existingMember) {
            throw new ConflictException('User is already a member');
        }

        const existingInvite = await this.invitations.existsPendingByWorkspaceAndEmail(
            workspaceId,
            email
        );

        if (existingInvite) {
            throw new ConflictException('A pending invitation already exists');
        }

        const token = randomBytes(32).toString('base64url');
        const invitation = await this.invitations.create({
            workspaceId,
            email,
            roleIds: dto.roleIds,
            tokenHash: tokenHash(token),
            invitedByUserId: invitedBy.userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        const inviteUrl = `${this.config.get<string>('app.frontendUrl')}/invite/${token}`;
        await this.mail.sendInvitation(email, workspace.name, inviteUrl);

        return {
            invitationId: invitation.id,
            email,
            roleIds: invitation.roleIds,
            expiresAt: invitation.expiresAt,
            inviteUrl
        };
    }

    async previewInvitation(token: string) {
        const invitation = await this.invitations.findPendingByTokenHash(tokenHash(token));

        if (!invitation) {
            throw new NotFoundException('Invitation not found or expired');
        }

        const workspace = await this.workspaces.findById(invitation.workspaceId);

        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        return {
            workspaceName: workspace.name,
            email: invitation.email,
            expiresAt: invitation.expiresAt
        };
    }

    async acceptInvitation(token: string, user: JwtUser, dto?: AcceptInvitationDto) {
        const invitation = await this.invitations.findPendingByTokenHash(tokenHash(token));

        if (!invitation) {
            throw new NotFoundException('Invitation not found or expired');
        }

        const workspace = await this.workspaces.findById(invitation.workspaceId);
        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        if (invitation.email !== normalizeEmail(user.email)) {
            throw new ForbiddenException('Invitation belongs to another email address');
        }

        const existing = await this.memberships.existsActiveByWorkspaceAndUser(
            invitation.workspaceId,
            user.userId
        );

        if (existing) {
            throw new ConflictException('You are already a member of this workspace');
        }

        const membership = await this.memberships.activateOrCreate({
            workspaceId: invitation.workspaceId,
            userId: user.userId,
            email: user.email,
            displayName: await this.defaultDisplayName(user, dto?.displayName),
            roleIds: invitation.roleIds
        });

        await this.invitations.markAccepted(invitation.id, user.userId);

        return {
            membershipId: membership.id,
            workspaceId: membership.workspaceId,
            displayName: membership.displayName || membership.email,
            roleIds: membership.roleIds
        };
    }

    private async ensureRolesBelongToWorkspace(workspaceId: string, roleIds: string[]) {
        if (!roleIds.length) {
            throw new BadRequestException('At least one role is required');
        }

        const count = await this.roles.countByWorkspaceAndIds(workspaceId, roleIds);

        if (count !== roleIds.length) {
            throw new BadRequestException('One or more roles do not belong to this workspace');
        }
    }

    private async prepareSubdomain(explicitSubdomain: string | undefined, workspaceName: string) {
        if (explicitSubdomain) {
            const subdomain = normalizeWorkspaceSubdomain(explicitSubdomain);
            const validationError = workspaceSubdomainValidationError(subdomain);

            if (validationError) {
                throw new BadRequestException(validationError);
            }

            if (await this.workspaces.existsBySubdomain(subdomain)) {
                throw new ConflictException('A workspace with this subdomain already exists');
            }

            return subdomain;
        }

        const base = generatedWorkspaceSubdomainBase(workspaceName);
        let subdomain = base;
        let suffix = 2;

        while (
            workspaceSubdomainValidationError(subdomain) ||
            (await this.workspaces.existsBySubdomain(subdomain))
        ) {
            subdomain = appendWorkspaceSubdomainSuffix(base, suffix++);
        }

        return subdomain;
    }

    private async defaultDisplayName(user: JwtUser, input?: string) {
        const displayName = input?.trim();

        if (displayName) {
            return displayName;
        }

        const profile = await this.users.findByProviderId(user.userId);

        return profile?.name?.trim() || user.email;
    }

    private async ensureRoleChangeKeepsAdmin(
        workspaceId: string,
        membership: MembershipRecord,
        nextRoleIds: string[]
    ) {
        const adminRoleIds = await this.adminRoleIds(workspaceId);
        const wasAdmin = this.hasAdminRole(membership.roleIds, adminRoleIds);
        const willBeAdmin = this.hasAdminRole(nextRoleIds, adminRoleIds);

        if (!wasAdmin || willBeAdmin) return;

        const otherAdmins = await this.memberships.countActiveAdminsExcluding(
            workspaceId,
            [...adminRoleIds],
            membership.userId
        );

        if (otherAdmins === 0) {
            throw new BadRequestException('At least one active admin must remain');
        }
    }

    private async isAdminMembership(workspaceId: string, membership: MembershipRecord) {
        return this.hasAdminRole(membership.roleIds, await this.adminRoleIds(workspaceId));
    }

    private async adminRoleIds(workspaceId: string) {
        const roles = await this.roles.findByWorkspace(workspaceId);
        return new Set(
            roles
                .filter((role) => role.permissions.includes(PERMISSIONS.all))
                .map((role) => role.id)
        );
    }

    private hasAdminRole(roleIds: string[], adminRoleIds: Set<string>) {
        return roleIds.some((roleId) => adminRoleIds.has(roleId));
    }

    private isDuplicateKeyError(error: unknown) {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: unknown }).code === 11000
        );
    }

    private workspaceDto(workspace?: WorkspaceRecord | null) {
        if (!workspace) {
            return null;
        }

        const subdomain = workspace.subdomain ?? workspace.slug;

        return {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            subdomain,
            ownerId: workspace.ownerId,
            status: workspace.status ?? 'active',
            deletedAt: workspace.deletedAt
        };
    }

    private roleDto(role: RoleRecord) {
        return {
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions ?? [],
            system: role.system ?? false
        };
    }

    private membershipDto(membership: MembershipRecord) {
        return {
            membershipId: membership.id,
            workspaceId: membership.workspaceId,
            userId: membership.userId,
            email: membership.email,
            displayName: membership.displayName || membership.email,
            roleIds: membership.roleIds,
            status: membership.status
        };
    }
}
