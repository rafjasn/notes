export interface User {
    userId: string;
    email: string;
    name?: string;
    phone?: string;
    mfaEnabled?: boolean;
    status: string;
}

export interface Workspace {
    id: string;
    _id?: string;
    name: string;
    slug: string;
    subdomain: string;
    ownerId: string;
    status: 'active' | 'deleted';
    deletedAt?: string;
}

export interface Membership {
    membershipId: string;
    workspaceId?: string;
    userId?: string;
    email?: string;
    displayName: string;
    roleIds: string[];
    status?: 'active' | 'suspended' | 'left';
}

export interface Role {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    system: boolean;
}

export interface Member {
    membershipId: string;
    userId: string;
    email: string;
    displayName: string;
    status: 'active' | 'suspended' | 'left';
    roles: Role[];
}

export interface WorkspaceListItem {
    membershipId: string;
    displayName: string;
    roleIds: string[];
    workspace: Workspace | null;
}

export interface ResolvedWorkspace {
    workspace: Workspace;
    membership: Membership;
}

export interface Note {
    id: string;
    _id?: string;
    workspaceId: string;
    userId: string;
    userEmail: string;
    version: number;
    title?: string;
    encryptedTitle?: string;
    titleIv?: string;
    content?: string;
    encrypted?: boolean;
    encryptedDataKey?: string;
    iv?: string;
    status?: 'active' | 'deleted';
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
    encryptionError?: string;
}

export interface NoteVersion extends Omit<
    Note,
    'workspaceId' | 'userId' | 'userEmail' | 'status' | 'updatedAt' | 'deletedAt'
> {
    workspaceId: string;
    noteId: string;
    changedByUserId: string;
    changedByUserEmail: string;
    changeType: 'updated' | 'deleted';
}

export interface InvitationResult {
    invitationId: string;
    email: string;
    roleIds: string[];
    expiresAt: string;
    inviteUrl: string;
}
