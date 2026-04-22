import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Note, NoteDocument } from '@database/schemas/note.schema';
import { UpdateNoteDto } from '@modules/notes/notes.dto';
import { MongoObject, RepositoryRecord, toRecord } from './repository-record';

export type NoteRecord = RepositoryRecord<Note>;

@Injectable()
export class NotesRepository {
    constructor(@InjectModel(Note.name) private readonly notes: Model<NoteDocument>) {}

    async create(data: {
        workspaceId: string;
        userId: string;
        userEmail: string;
        title?: string;
        encryptedTitle?: string;
        titleIv?: string;
        content?: string;
        encrypted?: boolean;
        encryptedDataKey?: string;
        iv?: string;
    }): Promise<NoteRecord> {
        const doc = await this.notes.create({
            ...data,
            version: 1,
            status: 'active'
        });

        return toRecord(doc.toObject() as MongoObject<Note>);
    }

    async findAll(workspaceId: string): Promise<NoteRecord[]> {
        const docs = await this.notes
            .find({ workspaceId, ...this.activeFilter() })
            .sort({ createdAt: -1 })
            .lean();

        return (docs as unknown as MongoObject<Note>[]).map((doc) => toRecord(doc));
    }

    async findDeleted(workspaceId: string): Promise<NoteRecord[]> {
        const docs = await this.notes
            .find({ workspaceId, status: 'deleted' })
            .sort({ deletedAt: -1, updatedAt: -1 })
            .lean();

        return (docs as unknown as MongoObject<Note>[]).map((doc) => toRecord(doc));
    }

    async findById(id: string, workspaceId: string): Promise<NoteRecord | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }

        const doc = await this.notes
            .findOne({ _id: id, workspaceId, ...this.activeFilter() })
            .lean();

        return doc ? toRecord(doc as MongoObject<Note>) : null;
    }

    async findByIdIncludingDeleted(id: string, workspaceId: string): Promise<NoteRecord | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }

        const doc = await this.notes.findOne({ _id: id, workspaceId }).lean();

        return doc ? toRecord(doc as MongoObject<Note>) : null;
    }

    async update(
        id: string,
        workspaceId: string,
        data: UpdateNoteDto,
        nextVersion: number,
        updatedBy: { userId: string; email: string }
    ): Promise<NoteRecord | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }

        const $set = Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined)
        );

        const doc = await this.notes.findOneAndUpdate(
            { _id: id, workspaceId, ...this.activeFilter() },
            {
                $set: {
                    ...$set,
                    version: nextVersion,
                    updatedByUserId: updatedBy.userId,
                    updatedByUserEmail: updatedBy.email
                }
            },
            { new: true }
        );

        return doc ? toRecord(doc.toObject() as MongoObject<Note>) : null;
    }

    async softDelete(
        id: string,
        workspaceId: string,
        deletedByUserId: string
    ): Promise<NoteRecord | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }

        const doc = await this.notes.findOneAndUpdate(
            { _id: id, workspaceId, ...this.activeFilter() },
            {
                status: 'deleted',
                deletedAt: new Date(),
                deletedByUserId
            },
            { new: true }
        );

        return doc ? toRecord(doc.toObject() as MongoObject<Note>) : null;
    }

    private activeFilter() {
        return {
            $or: [{ status: 'active' }, { status: { $exists: false } }]
        };
    }
}
