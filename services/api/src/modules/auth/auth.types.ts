export interface JwtUser {
    userId: string;
    email: string;
    workspaceId?: string;
    claims?: Record<string, unknown>;
}

export interface JwtPayload {
    sub: string;
    email: string;
    workspaceId?: string;
    type?: 'access' | 'refresh';
}
