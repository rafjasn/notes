import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyJwt } from '@notes/shared';
import { UsersRepository } from '@database/repositories';
import { JwtUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly config: ConfigService,
        private readonly users: UsersRepository
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<{ headers: Record<string, string>; user?: JwtUser }>();
        const header = request.headers.authorization;

        if (!header?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Bearer token required');
        }

        try {
            const token = header.slice('Bearer '.length);
            const verified = await verifyJwt(token, {
                provider: 'session',
                jwtSecret: this.config.get<string>('app.jwtSecret'),
                issuer: undefined,
                audience: undefined,
                jwksUri: undefined
            });

            const user = await this.users.findByProviderId(verified.sub);

            if (user?.status === 'disabled') {
                throw new UnauthorizedException('Account disabled');
            }

            request.user = {
                userId: verified.sub,
                email: verified.email,
                workspaceId:
                    typeof verified.claims.workspaceId === 'string'
                        ? verified.claims.workspaceId
                        : undefined,
                claims: verified.claims
            };

            return true;
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
