import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true })
export class Role {
    @Prop({ required: true, index: true })
    workspaceId!: string;

    @Prop({ required: true, trim: true })
    name!: string;

    @Prop({ trim: true })
    description?: string;

    @Prop({ type: [String], default: [] })
    permissions!: string[];

    @Prop({ default: false })
    system!: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
RoleSchema.index({ workspaceId: 1, name: 1 }, { unique: true });
