export const PERMISSIONS = {
    all: '*',
    workspaceDelete: 'workspace:delete',
    rolesManage: 'roles:manage',
    membersRead: 'members:read',
    membersInvite: 'members:invite',
    membersManage: 'members:manage',
    notesRead: 'notes:read',
    notesWrite: 'notes:write',
    notesDelete: 'notes:delete',
    notesReadDeleted: 'notes:read:deleted',
    notesVersionsRead: 'notes:versions:read'
} as const;

export const DEFAULT_MEMBER_PERMISSIONS = [PERMISSIONS.notesRead, PERMISSIONS.notesWrite];
