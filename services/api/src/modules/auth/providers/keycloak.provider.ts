import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, AuthTokens } from '../auth-provider.interface';

function keycloakNameParts(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const fallback = name.trim() || 'User';

    if (parts.length <= 1) {
        return { firstName: fallback, lastName: fallback };
    }

    return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts.at(-1)!
    };
}

export class KeycloakProvider implements AuthProvider {
    constructor(private readonly config: ConfigService) {}

    async register(email: string, password: string, name: string): Promise<string> {
        const adminToken = await this.getAdminToken();
        const { firstName, lastName } = keycloakNameParts(name);

        const response = await fetch(`${this.url}/admin/realms/${this.realm}/users`, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${adminToken}`,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                email,
                username: email,
                enabled: true,
                emailVerified: true,
                firstName,
                lastName,
                requiredActions: [],
                credentials: [{ type: 'password', value: password, temporary: false }]
            })
        });

        if (!response.ok) {
            const body = await response.text();
            let parsed: { errorMessage?: string; error?: string } = {};

            try {
                parsed = JSON.parse(body);
            } catch {}

            throw new BadRequestException(
                parsed.errorMessage ?? parsed.error ?? `Registration failed (${response.status})`
            );
        }

        return response.headers.get('location')!.split('/').pop()!;
    }

    async login(email: string, password: string): Promise<AuthTokens> {
        const response = await fetch(`${this.tokenUrl}`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                username: email,
                password,
                grant_type: 'password',
                scope: 'openid email profile'
            })
        });

        if (!response.ok) throw new UnauthorizedException('Invalid credentials');
        return (await response.json()) as AuthTokens;
    }

    async refresh(refreshToken: string): Promise<AuthTokens> {
        const response = await fetch(`${this.tokenUrl}`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        return (await response.json()) as AuthTokens;
    }

    async getOAuthUrl(redirectUri: string, state: string): Promise<string> {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state
        });

        return `${this.url}/realms/${this.realm}/protocol/openid-connect/auth?${params}`;
    }

    async changePassword(providerId: string, newPassword: string): Promise<void> {
        const adminToken = await this.getAdminToken();
        const response = await fetch(
            `${this.url}/admin/realms/${this.realm}/users/${providerId}/reset-password`,
            {
                method: 'PUT',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ type: 'password', value: newPassword, temporary: false })
            }
        );

        if (!response.ok) {
            throw new BadRequestException('Failed to change password');
        }
    }

    async handleOAuthCallback(code: string, redirectUri: string): Promise<AuthTokens> {
        const response = await fetch(`${this.tokenUrl}`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new UnauthorizedException(`OAuth callback failed: ${text}`);
        }

        return (await response.json()) as AuthTokens;
    }

    private async getAdminToken(): Promise<string> {
        const response = await fetch(`${this.tokenUrl}`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.adminClientId,
                client_secret: this.adminClientSecret
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get Keycloak admin token: ${error}`);
        }

        const data = (await response.json()) as { access_token: string };
        return data.access_token;
    }

    private get url(): string {
        return this.config.get<string>('app.auth.keycloak.url')!;
    }

    private get realm(): string {
        return this.config.get<string>('app.auth.keycloak.realm')!;
    }

    private get tokenUrl(): string {
        return `${this.url}/realms/${this.realm}/protocol/openid-connect/token`;
    }

    private get clientId(): string {
        return this.config.get<string>('app.auth.keycloak.clientId')!;
    }

    private get clientSecret(): string {
        return this.config.get<string>('app.auth.keycloak.clientSecret', '')!;
    }

    private get adminClientId(): string {
        return this.config.get<string>('app.auth.keycloak.adminClientId')!;
    }

    private get adminClientSecret(): string {
        return this.config.get<string>('app.auth.keycloak.adminClientSecret')!;
    }
}
