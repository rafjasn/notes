import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '@config/configuration';
import { AuthModule } from '@modules/auth/auth.module';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';
import { HealthModule } from '@modules/health/health.module';
import { MailModule } from '@modules/mail/mail.module';
import { NotesModule } from '@modules/notes/notes.module';
import { RealtimeModule } from '@modules/realtime/realtime.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        MongooseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                uri: config.get<string>('app.mongoUri')
            })
        }),
        AuthModule,
        MailModule,
        WorkspacesModule,
        NotesModule,
        RealtimeModule,
        HealthModule
    ]
})
export class AppModule {}
