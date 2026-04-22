import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@modules/auth/auth.module';
import { MailModule } from '@modules/mail/mail.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { InvitationsController } from './invitations.controller';
import { PermissionsGuard } from './permissions.guard';

@Module({
    imports: [AuthModule, MailModule, DatabaseModule],
    controllers: [WorkspacesController, InvitationsController],
    providers: [WorkspacesService, PermissionsGuard],
    exports: [WorkspacesService, PermissionsGuard]
})
export class WorkspacesModule {}
