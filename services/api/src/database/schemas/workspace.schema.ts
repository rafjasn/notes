import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WorkspaceDocument = HydratedDocument<Workspace>;

@Schema({ timestamps: true, collection: 'workspaces' })
export class Workspace {
    @Prop({ required: true, trim: true })
    name!: string;

    @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
    slug!: string;

    @Prop({ lowercase: true, trim: true })
    subdomain?: string;

    @Prop({ required: true, index: true })
    ownerId!: string;

    @Prop({ default: 'active', index: true })
    status!: 'active' | 'deleted';

    @Prop()
    deletedAt?: Date;

    @Prop()
    deletedByUserId?: string;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);

WorkspaceSchema.index({ subdomain: 1 }, { unique: true, sparse: true });
