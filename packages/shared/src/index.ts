export const DEFAULT_ROLE_PERMISSIONS = [
    'roles:manage',
    'members:read',
    'members:invite',
    'members:manage'
] as const;

export type DefaultPermission = (typeof DEFAULT_ROLE_PERMISSIONS)[number] | '*';

export * from './auth/jwt-verifier';
export * from './realtime/channels';
