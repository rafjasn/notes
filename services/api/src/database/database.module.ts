import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
    Workspace,
    WorkspaceSchema,
    Invitation,
    InvitationSchema,
    Membership,
    MembershipSchema,
    Note,
    NoteVersion,
    NoteVersionSchema,
    NoteSchema,
    Role,
    RoleSchema,
    User,
    UserSchema
} from './schemas';
import {
    WorkspacesRepository,
    InvitationsRepository,
    MembershipsRepository,
    NoteVersionsRepository,
    NotesRepository,
    RolesRepository,
    UsersRepository
} from './repositories';

const repositories = [
    WorkspacesRepository,
    InvitationsRepository,
    MembershipsRepository,
    NoteVersionsRepository,
    NotesRepository,
    RolesRepository,
    UsersRepository
];

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Workspace.name, schema: WorkspaceSchema },
            { name: Invitation.name, schema: InvitationSchema },
            { name: Membership.name, schema: MembershipSchema },
            { name: Note.name, schema: NoteSchema },
            { name: NoteVersion.name, schema: NoteVersionSchema },
            { name: Role.name, schema: RoleSchema },
            { name: User.name, schema: UserSchema }
        ])
    ],
    providers: repositories,
    exports: repositories
})
export class DatabaseModule {}
