import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import type { JwtUser } from '@modules/auth/auth.types';
import { PERMISSIONS } from '@modules/workspaces/permissions.constants';
import { RequirePermissions } from '@modules/workspaces/permissions.decorator';
import { PermissionsGuard } from '@modules/workspaces/permissions.guard';
import { ParseMongoIdPipe } from '@common/pipes/parse-mongo-id.pipe';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './notes.dto';

@ApiTags('notes')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotesController {
    constructor(private readonly notesService: NotesService) {}

    @Post('workspaces/:workspaceId/notes')
    @RequirePermissions(PERMISSIONS.notesWrite)
    @ApiOperation({ summary: 'Create a note (supports KMS-encrypted payload)' })
    create(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @CurrentUser() user: JwtUser,
        @Body() dto: CreateNoteDto
    ) {
        return this.notesService.create(workspaceId, user, dto);
    }

    @Get('workspaces/:workspaceId/notes')
    @RequirePermissions(PERMISSIONS.notesRead)
    @ApiOperation({ summary: 'List active notes for a workspace' })
    findAll(@Param('workspaceId', ParseMongoIdPipe) workspaceId: string) {
        return this.notesService.findAll(workspaceId);
    }

    @Get('workspaces/:workspaceId/notes/deleted')
    @RequirePermissions(PERMISSIONS.notesReadDeleted)
    @ApiOperation({ summary: 'List soft-deleted notes' })
    findDeleted(@Param('workspaceId', ParseMongoIdPipe) workspaceId: string) {
        return this.notesService.findDeleted(workspaceId);
    }

    @Get('workspaces/:workspaceId/notes/:noteId/versions')
    @RequirePermissions(PERMISSIONS.notesVersionsRead)
    @ApiOperation({ summary: 'List previous versions of a note' })
    findVersions(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @Param('noteId', ParseMongoIdPipe) noteId: string
    ) {
        return this.notesService.findVersions(workspaceId, noteId);
    }

    @Get('workspaces/:workspaceId/notes/:noteId')
    @RequirePermissions(PERMISSIONS.notesRead)
    @ApiOperation({ summary: 'Get a single note by id' })
    findOne(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @Param('noteId', ParseMongoIdPipe) noteId: string
    ) {
        return this.notesService.findOne(workspaceId, noteId);
    }

    @Patch('workspaces/:workspaceId/notes/:noteId')
    @RequirePermissions(PERMISSIONS.notesWrite)
    @ApiOperation({ summary: 'Update a note and create a version snapshot' })
    update(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @Param('noteId', ParseMongoIdPipe) noteId: string,
        @CurrentUser() user: JwtUser,
        @Body() dto: UpdateNoteDto
    ) {
        return this.notesService.update(workspaceId, noteId, user, dto);
    }

    @Delete('workspaces/:workspaceId/notes/:noteId')
    @RequirePermissions(PERMISSIONS.notesDelete)
    @ApiOperation({ summary: 'Soft-delete a note' })
    delete(
        @Param('workspaceId', ParseMongoIdPipe) workspaceId: string,
        @Param('noteId', ParseMongoIdPipe) noteId: string,
        @CurrentUser() user: JwtUser
    ) {
        return this.notesService.delete(workspaceId, noteId, user);
    }
}
