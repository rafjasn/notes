import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NoteVersionDocument = HydratedDocument<NoteVersion>;

@Schema({ timestamps: true })
export class NoteVersion {
    @Prop({ required: true, index: true })
    workspaceId!: string;

    @Prop({ required: true, index: true })
    noteId!: string;

    @Prop({ required: true })
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

    @Prop({ required: true })
    changedByUserId!: string;

    @Prop({ required: true })
    changedByUserEmail!: string;

    @Prop({ required: true })
    changeType!: 'updated' | 'deleted';
}

export const NoteVersionSchema = SchemaFactory.createForClass(NoteVersion);
NoteVersionSchema.index({ workspaceId: 1, noteId: 1, version: -1 });
