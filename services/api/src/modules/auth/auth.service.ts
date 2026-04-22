import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import { unsafeDecodeJwt } from '@notes/shared';
import {
    WorkspacesRepository,
    MembershipsRepository,
    UsersRepository
} from '@database/repositories';
import { MailService } from '@modules/mail/mail.service';
import { LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';
import type { JwtPayload, JwtUser } from './auth.types';
import type { AuthProvider, AuthTokens } from './auth-provider.interface';
import { AUTH_PROVIDER } from './providers/auth-provider.factory';
import { ChallengeStore } from './challenge-store.service';
import { MfaService } from './mfa.service';
import { SmsService } from './sms.service';
import { normalizeWorkspaceSubdomain } from '@modules/workspaces/subdomain';

interface ProviderPayload {
    sub: string;
    email?: string;
    preferred_username?: string;
    username?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    ['cognito:username']?: string;
}

interface OtpChallenge {
    type: 'email-otp' | 'sms-otp';
    identifier: string;
    code: string;
    workspaceSubdomain?: string;
}

interface MagicLinkTokenPayload {
    email: string;
    workspaceSubdomain?: string;
    type: 'magic-link';
}

interface MfaChallenge {
    userId: string;
    email: string;
    workspaceId?: string;
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
}

function tokenPayload(tokens: AuthTokens): ProviderPayload {
    const token = tokens.id_token ?? tokens.access_token;
    return unsafeDecodeJwt(token) as unknown as ProviderPayload;
}

function sixDigitCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

@Injectable()
export class AuthService {
    constructor(
        private readonly users: UsersRepository,
        private readonly workspaces: WorkspacesRepository,
        private readonly memberships: MembershipsRepository,
        @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly mail: MailService,
        private readonly sms: SmsService,
        private readonly challenges: ChallengeStore,
        private readonly mfa: MfaService
    ) {}

    async register(dto: RegisterDto) {
        const email = normalizeEmail(dto.email);
        const providerId = await this.authProvider.register(email, dto.password, dto.name);

        await this.upsertUser({ providerId, email, name: dto.name });
        return this.issueTokens(providerId, email);
    }

    async login(dto: LoginDto) {
        const providerTokens = await this.authProvider.login(
            normalizeEmail(dto.email),
            dto.password
        );
        return this.completeLogin(providerTokens, dto.workspaceSubdomain ?? dto.workspaceSlug);
    }

    async refresh(refreshToken: string) {
        let payload: JwtPayload;

        try {
            payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken);
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (payload.type !== 'refresh') {
            throw new UnauthorizedException('Refresh token required');
        }

        const user = await this.users.findByProviderId(payload.sub);

        if (user?.status === 'disabled') {
            throw new UnauthorizedException('Account disabled');
        }

        return this.issueTokens(payload.sub, payload.email, payload.workspaceId);
    }

    async me(user: JwtUser) {
        const doc = await this.users.findByProviderId(user.userId);

        return {
            userId: user.userId,
            email: user.email,
            name: doc?.name,
            status: doc?.status ?? 'active',
            mfaEnabled: doc?.mfaEnabled ?? false
        };
    }

    async initiateEmailOtp(
        email: string,
        workspaceSubdomain?: string
    ): Promise<{ challengeId: string }> {
        const normalized = normalizeEmail(email);
        const user = await this.users.findByEmail(normalized);

        if (!user) {
            return { challengeId: this.challenges.generateId() };
        }

        const code = sixDigitCode();
        const challengeId = this.challenges.generateId();
        this.challenges.set<OtpChallenge>(
            challengeId,
            { type: 'email-otp', identifier: normalized, code, workspaceSubdomain },
            10 * 60
        );

        await this.mail.sendOtp(email, code);

        return { challengeId };
    }

    async verifyEmailOtp(challengeId: string, code: string) {
        const challenge = this.challenges.consume<OtpChallenge>(challengeId);

        if (!challenge || challenge.type !== 'email-otp') {
            throw new UnauthorizedException('Invalid or expired code');
        }

        if (challenge.code !== code) {
            throw new UnauthorizedException('Invalid or expired code');
        }

        const user = await this.users.findByEmail(challenge.identifier);

        if (!user) {
            throw new UnauthorizedException('Invalid or expired code');
        }

        await this.users.touchLastLogin(user.providerId);

        return this.issueOrMfaChallenge(
            user.providerId,
            user.email,
            user.mfaEnabled ?? false,
            user.mfaTotpSecret,
            challenge.workspaceSubdomain
        );
    }

    async initiateMagicLink(email: string, workspaceSubdomain?: string): Promise<void> {
        const normalized = normalizeEmail(email);
        const user = await this.users.findByEmail(normalized);

        if (!user) {
            return;
        }

        const token = await this.jwt.signAsync(
            {
                email: normalized,
                workspaceSubdomain,
                type: 'magic-link'
            } satisfies MagicLinkTokenPayload,
            { expiresIn: '15m' }
        );
        const frontendUrl = this.config.get<string>('app.frontendUrl', 'http://localhost');

        await this.mail.sendMagicLink(
            email,
            `${frontendUrl}/api/bff/auth/magic-link/verify?token=${token}`
        );
    }

    async verifyMagicLink(token: string) {
        let challenge: MagicLinkTokenPayload;

        try {
            challenge = await this.jwt.verifyAsync<MagicLinkTokenPayload>(token);
        } catch {
            throw new UnauthorizedException('Invalid or expired link');
        }

        if (challenge.type !== 'magic-link') {
            throw new UnauthorizedException('Invalid or expired link');
        }

        const user = await this.users.findByEmail(challenge.email);

        if (!user) {
            throw new UnauthorizedException('Invalid or expired link');
        }

        await this.users.touchLastLogin(user.providerId);

        return this.issueOrMfaChallenge(
            user.providerId,
            user.email,
            user.mfaEnabled ?? false,
            user.mfaTotpSecret,
            challenge.workspaceSubdomain
        );
    }

    async initiateSmsOtp(
        phone: string,
        workspaceSubdomain?: string
    ): Promise<{ challengeId: string }> {
        const normalized = normalizePhone(phone);
        const user = await this.users.findByPhone(normalized);

        if (!user) {
            return { challengeId: this.challenges.generateId() };
        }

        const code = sixDigitCode();
        const challengeId = this.challenges.generateId();
        this.challenges.set<OtpChallenge>(
            challengeId,
            { type: 'sms-otp', identifier: normalized, code, workspaceSubdomain },
            10 * 60
        );

        await this.sms.sendOtp(phone, code);

        return { challengeId };
    }

    async verifySmsOtp(challengeId: string, code: string) {
        const challenge = this.challenges.consume<OtpChallenge>(challengeId);

        if (!challenge || challenge.type !== 'sms-otp') {
            throw new UnauthorizedException('Invalid or expired code');
        }

        if (challenge.code !== code) {
            throw new UnauthorizedException('Invalid or expired code');
        }

        const user = await this.users.findByPhone(challenge.identifier);

        if (!user) {
            throw new UnauthorizedException('Invalid or expired code');
        }

        return this.issueOrMfaChallenge(
            user.providerId,
            user.email,
            user.mfaEnabled,
            user.mfaTotpSecret,
            challenge.workspaceSubdomain
        );
    }

    async getOAuthUrl(redirectUri: string): Promise<{ url: string; state: string }> {
        const state = this.challenges.generateId();
        this.challenges.set(`oauth:${state}`, { redirectUri }, 10 * 60);

        const url = await this.authProvider.getOAuthUrl(redirectUri, state);

        return { url, state };
    }

    async handleOAuthCallback(code: string, state: string, redirectUri: string) {
        const stored = this.challenges.consume<{ redirectUri: string }>(`oauth:${state}`);

        if (!stored) {
            throw new UnauthorizedException('Invalid or expired OAuth state');
        }

        if (stored.redirectUri !== redirectUri)
            throw new UnauthorizedException('Redirect URI mismatch');

        const providerTokens = await this.authProvider.handleOAuthCallback(code, redirectUri);

        return this.completeLogin(providerTokens);
    }

    async setupMfa(user: JwtUser): Promise<{ secret: string; uri: string }> {
        const secret = this.mfa.generateSecret();
        const issuer = this.config.get<string>('app.name', 'NotesApp');

        await this.users.storePendingMfaSecret(user.userId, secret);

        return {
            secret,
            uri: this.mfa.buildUri(secret, user.email, issuer)
        };
    }

    async enableMfa(user: JwtUser, code: string): Promise<void> {
        const doc = await this.users.findByProviderId(user.userId);

        if (!doc?.mfaPendingSecret) {
            throw new BadRequestException('No MFA setup in progress');
        }

        if (!this.mfa.verify(doc.mfaPendingSecret, code)) {
            throw new BadRequestException('Invalid code');
        }

        await this.users.activateMfa(user.userId, doc.mfaPendingSecret);
    }

    async disableMfa(user: JwtUser): Promise<void> {
        await this.users.disableMfa(user.userId);
    }

    async verifyMfaChallenge(challengeId: string, code: string) {
        const challenge = this.challenges.consume<MfaChallenge>(challengeId);

        if (!challenge) {
            throw new UnauthorizedException('Invalid or expired MFA session');
        }

        const doc = await this.users.findByProviderId(challenge.userId);
        if (!doc?.mfaEnabled || !doc.mfaTotpSecret) {
            throw new UnauthorizedException('MFA not configured');
        }

        if (!this.mfa.verify(doc.mfaTotpSecret, code)) {
            throw new UnauthorizedException('Invalid code');
        }

        return this.issueTokens(challenge.userId, challenge.email, challenge.workspaceId);
    }

    async forgotPassword(email: string): Promise<void> {
        const user = await this.users.findByEmail(normalizeEmail(email));

        if (!user) {
            return;
        }

        const token = this.challenges.generateId();
        this.challenges.set(
            `pwreset:${token}`,
            { userId: user.providerId, email: user.email },
            15 * 60
        );

        const frontendUrl = this.config.get<string>('app.frontendUrl', 'http://localhost');

        await this.mail.sendPasswordReset(
            user.email,
            `${frontendUrl}/reset-password?token=${token}`
        );
    }

    async resetPassword(token: string, newPassword: string) {
        const stored = this.challenges.consume<{ userId: string; email: string }>(
            `pwreset:${token}`
        );

        if (!stored) throw new UnauthorizedException('Invalid or expired reset token');

        const user = await this.users.findByProviderId(stored.userId);

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.mfaEnabled && user.mfaTotpSecret) {
            const challengeId = this.challenges.generateId();
            this.challenges.set(
                challengeId,
                { userId: stored.userId, email: stored.email, newPassword },
                5 * 60
            );

            return { requiresMfa: true as const, challengeId };
        }

        await this.authProvider.changePassword(stored.userId, newPassword);

        return this.issueTokens(stored.userId, stored.email);
    }

    async confirmResetPasswordMfa(challengeId: string, code: string) {
        const challenge = this.challenges.consume<{
            userId: string;
            email: string;
            newPassword: string;
        }>(challengeId);

        if (!challenge) {
            throw new UnauthorizedException('Invalid or expired session');
        }

        const user = await this.users.findByProviderId(challenge.userId);

        if (!user?.mfaEnabled || !user.mfaTotpSecret) {
            throw new UnauthorizedException('MFA not configured');
        }

        if (!this.mfa.verify(user.mfaTotpSecret, code)) {
            throw new UnauthorizedException('Invalid code');
        }

        await this.authProvider.changePassword(challenge.userId, challenge.newPassword);

        return this.issueTokens(challenge.userId, challenge.email);
    }

    async updateProfile(user: JwtUser, dto: UpdateProfileDto) {
        const updated = await this.users.updateProfile(user.userId, {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone ?? null } : {})
        });

        return {
            userId: user.userId,
            email: user.email,
            name: updated?.name,
            phone: updated?.phone,
            status: updated?.status ?? 'active',
            mfaEnabled: updated?.mfaEnabled ?? false
        };
    }

    private async completeLogin(providerTokens: AuthTokens, workspaceSubdomain?: string) {
        const payload = tokenPayload(providerTokens);
        const email = normalizeEmail(
            payload.email ?? payload.preferred_username ?? payload['cognito:username'] ?? ''
        );
        const name =
            (payload.name ?? [payload.given_name, payload.family_name].filter(Boolean).join(' ')) ||
            email;

        const user = await this.upsertUser({
            providerId: payload.sub,
            email,
            name
        });

        return this.issueOrMfaChallenge(
            payload.sub,
            email,
            user.mfaEnabled ?? false,
            user.mfaTotpSecret,
            workspaceSubdomain
        );
    }

    private async issueOrMfaChallenge(
        userId: string,
        email: string,
        mfaEnabled: boolean,
        mfaSecret: string | undefined,
        workspaceSubdomain?: string
    ) {
        const workspaceId = await this.resolveWorkspaceId(userId, workspaceSubdomain);

        if (mfaEnabled && mfaSecret) {
            const challengeId = this.challenges.generateId();
            this.challenges.set<MfaChallenge>(challengeId, { userId, email, workspaceId }, 5 * 60);
            return { requiresMfa: true as const, challengeId };
        }

        return this.issueTokens(userId, email, workspaceId);
    }

    private async resolveWorkspaceId(
        userId: string,
        workspaceSubdomain?: string
    ): Promise<string | undefined> {
        if (!workspaceSubdomain) {
            return undefined;
        }

        const normalized = normalizeWorkspaceSubdomain(workspaceSubdomain);
        const workspace = normalized ? await this.workspaces.findBySubdomain(normalized) : null;

        if (!workspace) {
            throw new NotFoundException(`No workspace "${workspaceSubdomain}"`);
        }

        const membership = await this.memberships.findActiveByWorkspaceAndUser(
            workspace.id,
            userId
        );

        if (!membership) {
            throw new UnauthorizedException('Not a member of this workspace');
        }

        return workspace.id;
    }

    private async upsertUser(input: {
        providerId: string;
        email: string;
        name: string;
        phone?: string;
    }) {
        const provider = this.config.get<'keycloak' | 'cognito'>('app.auth.provider', 'keycloak');

        return this.users.upsertFromProvider({ ...input, provider });
    }

    private async issueTokens(userId: string, email: string, workspaceId?: string) {
        const accessExpiresIn = this.config.get<string>(
            'app.jwtExpiresIn',
            '15m'
        ) as JwtSignOptions['expiresIn'];
        const refreshExpiresIn = this.config.get<string>(
            'app.jwtRefreshExpiresIn',
            '7d'
        ) as JwtSignOptions['expiresIn'];
        const accessPayload: JwtPayload = {
            sub: userId,
            email,
            workspaceId,
            type: 'access'
        };
        const refreshPayload: JwtPayload = {
            sub: userId,
            email,
            workspaceId,
            type: 'refresh'
        };

        return {
            accessToken: await this.jwt.signAsync(accessPayload, {
                expiresIn: accessExpiresIn
            }),
            refreshToken: await this.jwt.signAsync(refreshPayload, {
                expiresIn: refreshExpiresIn
            }),
            userId,
            email,
            workspaceId
        };
    }
}
