import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    AdminSetUserPasswordCommand,
    AuthFlowType,
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    SignUpCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { AuthProvider, AuthTokens } from '../auth-provider.interface';

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export class CognitoProvider implements AuthProvider {
    private readonly client: CognitoIdentityProviderClient;

    constructor(private readonly config: ConfigService) {
        this.client = new CognitoIdentityProviderClient({
            region: config.get<string>('app.aws.region', 'us-east-1')
        });
    }

    async register(email: string, password: string, name: string): Promise<string> {
        try {
            const response = await this.client.send(
                new SignUpCommand({
                    ClientId: this.clientId,
                    Username: email,
                    Password: password,
                    UserAttributes: [
                        { Name: 'email', Value: email },
                        { Name: 'name', Value: name }
                    ]
                })
            );

            return response.UserSub!;
        } catch (error: unknown) {
            throw new BadRequestException(errorMessage(error, 'Registration failed'));
        }
    }

    async login(email: string, password: string): Promise<AuthTokens> {
        try {
            const response = await this.client.send(
                new InitiateAuthCommand({
                    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
                    ClientId: this.clientId,
                    AuthParameters: {
                        USERNAME: email,
                        PASSWORD: password
                    }
                })
            );

            return {
                access_token: response.AuthenticationResult!.AccessToken!,
                id_token: response.AuthenticationResult!.IdToken,
                refresh_token: response.AuthenticationResult!.RefreshToken!,
                expires_in: response.AuthenticationResult!.ExpiresIn!
            };
        } catch {
            throw new UnauthorizedException('Invalid credentials');
        }
    }

    async refresh(refreshToken: string): Promise<AuthTokens> {
        try {
            const response = await this.client.send(
                new InitiateAuthCommand({
                    AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
                    ClientId: this.clientId,
                    AuthParameters: {
                        REFRESH_TOKEN: refreshToken
                    }
                })
            );

            return {
                access_token: response.AuthenticationResult!.AccessToken!,
                id_token: response.AuthenticationResult!.IdToken,
                refresh_token: refreshToken,
                expires_in: response.AuthenticationResult!.ExpiresIn!
            };
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async changePassword(providerId: string, newPassword: string): Promise<void> {
        try {
            await this.client.send(
                new AdminSetUserPasswordCommand({
                    UserPoolId: this.userPoolId,
                    Username: providerId,
                    Password: newPassword,
                    Permanent: true
                })
            );
        } catch (error: unknown) {
            throw new BadRequestException(errorMessage(error, 'Failed to change password'));
        }
    }

    async getOAuthUrl(redirectUri: string, state: string): Promise<string> {
        const domain = this.hostedUiDomain;

        if (!domain) {
            throw new Error('COGNITO_HOSTED_UI_DOMAIN is not configured');
        }

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state
        });

        return `${domain}/oauth2/authorize?${params}`;
    }

    async handleOAuthCallback(code: string, redirectUri: string): Promise<AuthTokens> {
        const domain = this.hostedUiDomain;

        if (!domain) {
            throw new Error('COGNITO_HOSTED_UI_DOMAIN is not configured');
        }

        const headers: Record<string, string> = {
            'content-type': 'application/x-www-form-urlencoded'
        };

        if (this.clientSecret) {
            headers.authorization = `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;
        }

        const response = await fetch(`${domain}/oauth2/token`, {
            method: 'POST',
            headers,
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.clientId,
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

    private get clientId(): string {
        return this.config.get<string>('app.auth.cognito.clientId')!;
    }

    private get userPoolId(): string {
        return this.config.get<string>('app.auth.cognito.userPoolId')!;
    }

    private get clientSecret(): string {
        return this.config.get<string>('app.auth.cognito.clientSecret', '')!;
    }

    private get hostedUiDomain(): string | undefined {
        return this.config.get<string>('app.auth.cognito.hostedUiDomain');
    }
}
