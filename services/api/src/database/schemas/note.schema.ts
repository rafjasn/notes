import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NoteDocument = HydratedDocument<Note>;

@Schema({ timestamps: true })
export class Note {
    @Prop({ required: true, index: true })
    workspaceId!: string;

    @Prop({ required: true })
    userId!: string;

    @Prop({ required: true })
    userEmail!: string;

    @Prop({ default: 1 })
    version!: number;

    @Prop({ trim: true })
    title?: string;

    @Prop()
    encryptedTitle?: string;

    @Prop()
    titleIv?: string;

    @Prop({ default: '' })
    content!: string;

    @Prop({ default: false })
    encrypted!: boolean;

    @Prop()
    encryptedDataKey?: string;

    @Prop()
    iv?: string;

    @Prop({ default: 'active', index: true })
    status!: 'active' | 'deleted';

    @Prop()
    updatedByUserId?: string;

    @Prop()
    updatedByUserEmail?: string;

    @Prop()
    deletedAt?: Date;

    @Prop()
    deletedByUserId?: string;
}

export const NoteSchema = SchemaFactory.createForClass(Note);
NoteSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
