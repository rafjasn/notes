import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NoteVersionsRepository, NotesRepository } from '@database/repositories';
import { JwtUser } from '@modules/auth/auth.types';
import { RealtimeService } from '@modules/realtime/realtime.service';
import { CreateNoteDto, UpdateNoteDto } from './notes.dto';

@Injectable()
export class NotesService {
    private readonly logger = new Logger(NotesService.name);

    constructor(
        private readonly repo: NotesRepository,
        private readonly versions: NoteVersionsRepository,
        private readonly realtime: RealtimeService
    ) {}

    async create(workspaceId: string, user: JwtUser, dto: CreateNoteDto) {
        const note = await this.repo.create({
            workspaceId,
            userId: user.userId,
            userEmail: user.email,
            ...dto
        });

        await this.publish(workspaceId, 'note.created', note);

        return note;
    }

    async findAll(workspaceId: string) {
        return this.repo.findAll(workspaceId);
    }

    async findDeleted(workspaceId: string) {
        return this.repo.findDeleted(workspaceId);
    }

    async findOne(workspaceId: string, id: string) {
        const note = await this.repo.findById(id, workspaceId);

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        return note;
    }

    async findVersions(workspaceId: string, id: string) {
        const note = await this.repo.findByIdIncludingDeleted(id, workspaceId);

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        return this.versions.findByNote(workspaceId, id);
    }

    async update(workspaceId: string, id: string, user: JwtUser, dto: UpdateNoteDto) {
        const existing = await this.repo.findById(id, workspaceId);

        if (!existing) {
            throw new NotFoundException('Note not found');
        }

        if (!Object.keys(dto).length) {
            return existing;
        }

        const updated = await this.repo.update(id, workspaceId, dto, (existing.version ?? 1) + 1, {
            userId: user.userId,
            email: user.email
        });

        if (!updated) {
            throw new NotFoundException('Note not found');
        }

        await this.versions.createFromNote(
            existing,
            { userId: user.userId, email: user.email },
            'updated'
        );

        await this.publish(workspaceId, 'note.updated', updated);

        return updated;
    }

    async delete(workspaceId: string, id: string, user: JwtUser) {
        const existing = await this.repo.findById(id, workspaceId);

        if (!existing) {
            throw new NotFoundException('Note not found');
        }

        const deleted = await this.repo.softDelete(id, workspaceId, user.userId);
        if (!deleted) {
            throw new NotFoundException('Note not found');
        }

        await this.versions.createFromNote(
            existing,
            { userId: user.userId, email: user.email },
            'deleted'
        );

        await this.publish(workspaceId, 'note.deleted', {
            id,
            workspaceId,
            deletedAt: deleted.deletedAt
        });

        return { deleted: true, note: deleted };
    }

    private async publish(workspaceId: string, event: string, payload: unknown) {
        try {
            await this.realtime.trigger(`private-workspace:${workspaceId}:notes`, event, payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to publish ${event} for workspace ${workspaceId}: ${message}`);
        }
    }
}
