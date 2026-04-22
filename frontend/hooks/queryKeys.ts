export const queryKeys = {
    me: ['me'] as const,
    workspaces: ['workspaces'] as const,
    workspaceBySubdomain: (subdomain: string | null) =>
        ['workspace', 'subdomain', subdomain] as const,
    notes: (workspaceId: string | null) => ['workspace', workspaceId, 'notes'] as const,
    deletedNotes: (workspaceId: string | null) =>
        ['workspace', workspaceId, 'notes', 'deleted'] as const,
    noteVersions: (workspaceId: string | null, noteId: string | null) =>
        ['workspace', workspaceId, 'notes', noteId, 'versions'] as const,
    roles: (workspaceId: string | null) => ['workspace', workspaceId, 'roles'] as const,
    members: (workspaceId: string | null) => ['workspace', workspaceId, 'members'] as const
};
