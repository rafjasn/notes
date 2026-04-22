import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InvitationDocument = HydratedDocument<Invitation>;

@Schema({ timestamps: true })
export class Invitation {
    @Prop({ required: true, index: true })
    workspaceId!: string;

    @Prop({ required: true, lowercase: true, trim: true, index: true })
    email!: string;

    @Prop({ type: [String], default: [] })
    roleIds!: string[];

    @Prop({ required: true, unique: true, index: true })
    tokenHash!: string;

    @Prop({ required: true })
    invitedByUserId!: string;

    @Prop()
    acceptedByUserId?: string;

    @Prop({ required: true })
    expiresAt!: Date;

    @Prop({ default: 'pending' })
    status!: 'pending' | 'accepted' | 'revoked' | 'expired';
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);
InvitationSchema.index({ workspaceId: 1, email: 1, status: 1 });
