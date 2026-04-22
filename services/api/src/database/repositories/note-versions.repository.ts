import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NoteVersion, NoteVersionDocument } from '@database/schemas/note-version.schema';
import { NoteRecord } from './notes.repository';
import { MongoObject, RepositoryRecord, toRecord } from './repository-record';

export type NoteVersionRecord = RepositoryRecord<NoteVersion>;

@Injectable()
export class NoteVersionsRepository {
    constructor(
        @InjectModel(NoteVersion.name) private readonly versions: Model<NoteVersionDocument>
    ) {}

    async createFromNote(
        note: NoteRecord,
        changedBy: { userId: string; email: string },
        changeType: 'updated' | 'deleted'
    ): Promise<NoteVersionRecord> {
        const doc = await this.versions.create({
            workspaceId: note.workspaceId,
            noteId: note.id,
            version: note.version ?? 1,
            title: note.title,
            encryptedTitle: note.encryptedTitle,
            titleIv: note.titleIv,
            content: note.content,
            encrypted: note.encrypted,
            encryptedDataKey: note.encryptedDataKey,
            iv: note.iv,
            changedByUserId: changedBy.userId,
            changedByUserEmail: changedBy.email,
            changeType
        });

        return toRecord(doc.toObject() as MongoObject<NoteVersion>);
    }

    async findByNote(workspaceId: string, noteId: string): Promise<NoteVersionRecord[]> {
        if (!Types.ObjectId.isValid(noteId)) {
            return [];
        }

        const docs = await this.versions
            .find({ workspaceId, noteId })
            .sort({ version: -1, createdAt: -1 })
            .lean();

        return (docs as unknown as MongoObject<NoteVersion>[]).map((doc) => toRecord(doc));
    }
}
