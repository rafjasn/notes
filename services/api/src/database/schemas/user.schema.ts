import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true, index: true })
    providerId!: string;

    @Prop({ required: true, index: true })
    provider!: 'keycloak' | 'cognito';

    @Prop({ required: true, index: true, lowercase: true, trim: true })
    email!: string;

    @Prop({ index: true, sparse: true })
    phone?: string;

    @Prop({ required: true, trim: true })
    name!: string;

    @Prop({ default: 'active' })
    status!: 'active' | 'disabled';

    @Prop({ default: false })
    mfaEnabled!: boolean;

    @Prop()
    mfaTotpSecret?: string;

    @Prop()
    mfaPendingSecret?: string;

    @Prop()
    lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ provider: 1, providerId: 1 }, { unique: true });
