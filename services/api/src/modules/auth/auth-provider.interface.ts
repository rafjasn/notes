export interface AuthProvider {
    register(email: string, password: string, name: string): Promise<string>;
    login(email: string, password: string): Promise<AuthTokens>;
    refresh(refreshToken: string): Promise<AuthTokens>;
    changePassword(providerId: string, newPassword: string): Promise<void>;
    getOAuthUrl(redirectUri: string, state: string): Promise<string>;
    handleOAuthCallback(code: string, redirectUri: string): Promise<AuthTokens>;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    id_token?: string;
}
