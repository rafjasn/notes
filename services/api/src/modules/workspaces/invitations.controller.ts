import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import type { JwtUser } from '@modules/auth/auth.types';
import { AcceptInvitationDto } from './workspaces.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
    constructor(private readonly workspaces: WorkspacesService) {}

    @Get(':token/preview')
    @ApiOperation({ summary: 'Preview an invitation (public — no auth required)' })
    preview(@Param('token') token: string) {
        return this.workspaces.previewInvitation(token);
    }

    @Post(':token/accept')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Accept an invitation and join the workspace' })
    accept(
        @Param('token') token: string,
        @CurrentUser() user: JwtUser,
        @Body() dto: AcceptInvitationDto
    ) {
        return this.workspaces.acceptInvitation(token, user, dto);
    }
}
