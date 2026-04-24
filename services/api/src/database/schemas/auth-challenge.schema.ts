import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AuthChallengeDocument = HydratedDocument<AuthChallenge>;

@Schema({ timestamps: true })
export class AuthChallenge {
    @Prop({ required: true, unique: true, index: true })
    key!: string;

    @Prop({ type: MongooseSchema.Types.Mixed, required: true })
    data!: unknown;

    @Prop({ required: true })
    expiresAt!: Date;
}

export const AuthChallengeSchema = SchemaFactory.createForClass(AuthChallenge);
AuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
