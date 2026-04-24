import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import type { JwtUser } from '@modules/auth/auth.types';
import { ParseMongoIdPipe } from '@common/pipes/parse-mongo-id.pipe';
import { WorkspacesService } from './workspaces.service';
import {
    AuthorizeKmsDto,
    CreateWorkspaceDto,
    CreateRoleDto,
    InviteUserDto,
    UpdateMemberRolesDto,
    UpdateMyWorkspaceProfileDto
} from './workspaces.dto';
import { PERMISSIONS } from './permissions.constants';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
    constructor(private readonly workspaces: WorkspacesService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Create a new workspace' })
    createWorkspace(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: JwtUser) {
        return this.workspaces.createWorkspace(dto, user);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'List workspaces the current user belongs to' })
    listMine(@CurrentUser() user: JwtUser) {
        return this.workspaces.listMyWorkspaces(user);
    }

    @Get('resolve/:subdomain')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Resolve a workspace by subdomain and verify membership' })
    resolveBySubdomain(@Param('subdomain') subdomain: string, @CurrentUser() user: JwtUser) {
        return this.workspaces.resolveBySubdomain(subdomain, user);
    }

    @Get(':workspaceId/members')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermissions(PERMISSIONS.membersRead)
    @ApiOperation({ summary: 'List members of a workspace' })
    listMembers(@Param('workspaceId', ParseMongoIdPipe) workspaceId: string) {
        return this.workspaces.listMembers(workspaceId);
    }

    @Patch(':workspaceId/me')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @ApiOperation({ summary: "Update current user's display name within a workspace" })
    updateMyWorkspaceProfile(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @CurrentUser() user: JwtUser,
        @Body() dto: UpdateMyWorkspaceProfileDto
    ) {
        return this.workspaces.updateMyWorkspaceProfile(workspaceId, user, dto);
    }

    @Delete(':workspaceId/members/me')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @ApiOperation({ summary: 'Leave a workspace' })
    leaveWorkspace(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @CurrentUser() user: JwtUser
    ) {
        return this.workspaces.leaveWorkspace(workspaceId, user);
    }

    @Delete(':workspaceId')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermissions(PERMISSIONS.workspaceDelete)
    @ApiOperation({ summary: 'Soft-delete a workspace (owner only)' })
    deleteWorkspace(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @CurrentUser() user: JwtUser
    ) {
        return this.workspaces.deleteWorkspace(workspaceId, user);
    }

    @Get(':workspaceId/roles')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermissions(PERMISSIONS.rolesManage)
    @ApiOperation({ summary: 'List roles defined for a workspace' })
    listRoles(@Param('workspaceId', ParseMongoIdPipe) workspaceId: string) {
        return this.workspaces.listRoles(workspaceId);
    }

    @Post(':workspaceId/roles')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermissions(PERMISSIONS.rolesManage)
    @ApiOperation({ summary: 'Create a custom role for a workspace' })
    createRole(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @Body() dto: CreateRoleDto
    ) {
        return this.workspaces.createRole(workspaceId, dto);
    }

    @Patch(':workspaceId/members/:userId/roles')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermissions(PERMISSIONS.membersManage)
    @ApiOperation({ summary: "Update a member's roles" })
    updateMemberRoles(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @Param('userId', ParseMongoIdPipe) userId: string,
        @Body() dto: UpdateMemberRolesDto
    ) {
        return this.workspaces.updateMemberRoles(workspaceId, userId, dto);
    }

    @Post(':workspaceId/kms/authorize')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Authorize a workspace-scoped KMS operation' })
    authorizeKms(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @CurrentUser() user: JwtUser,
        @Body() dto: AuthorizeKmsDto
    ) {
        return this.workspaces.authorizeKms(workspaceId, user, dto.operation);
    }

    @Post(':workspaceId/invitations')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermissions(PERMISSIONS.membersInvite)
    @ApiOperation({ summary: 'Send an email invitation to join the workspace' })
    invite(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @Body() dto: InviteUserDto,
        @CurrentUser() user: JwtUser
    ) {
        return this.workspaces.inviteUser(workspaceId, dto, user);
    }
}
