import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@database/database.module';
import { MailModule } from '@modules/mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthProviderFactory, AUTH_PROVIDER } from './providers/auth-provider.factory';
import { ChallengeStore } from './challenge-store.service';
import { MfaService } from './mfa.service';
import { SmsService } from './sms.service';

@Module({
    imports: [
        DatabaseModule,
        MailModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('app.jwtSecret')
            })
        })
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtAuthGuard,
        AuthProviderFactory,
        ChallengeStore,
        MfaService,
        SmsService
    ],
    exports: [AuthService, JwtAuthGuard, AUTH_PROVIDER]
})
export class AuthModule {}
