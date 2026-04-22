import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@modules/auth/auth.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';

@Module({
    imports: [AuthModule, DatabaseModule],
    controllers: [RealtimeController],
    providers: [RealtimeService],
    exports: [RealtimeService]
})
export class RealtimeModule {}
