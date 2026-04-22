import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@modules/auth/auth.module';
import { PermissionsGuard } from '@modules/workspaces/permissions.guard';
import { RealtimeModule } from '@modules/realtime/realtime.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
    imports: [AuthModule, RealtimeModule, DatabaseModule],
    controllers: [NotesController],
    providers: [NotesService, PermissionsGuard],
    exports: [NotesService]
})
export class NotesModule {}
