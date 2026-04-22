import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({ timestamps: true })
export class Membership {
    @Prop({ required: true, index: true })
    workspaceId!: string;

    @Prop({ required: true, index: true })
    userId!: string;

    @Prop({ required: true, lowercase: true, trim: true, index: true })
    email!: string;

    @Prop({ required: true, trim: true })
    displayName!: string;

    @Prop({ type: [String], default: [] })
    roleIds!: string[];

    @Prop({ default: 'active' })
    status!: 'active' | 'suspended' | 'left';

    @Prop()
    leftAt?: Date;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
MembershipSchema.index({ workspaceId: 1, email: 1 });
