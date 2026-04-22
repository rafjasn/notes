import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyJwt } from '@notes/shared';
import { SocketUser } from './fanout.types';

@Injectable()
export class AuthTokenService {
    constructor(private readonly config: ConfigService) {}

    async verify(token: string): Promise<SocketUser> {
        try {
            const verified = await verifyJwt(token, {
                provider: 'session',
                jwtSecret: this.config.get<string>('fanout.auth.jwtSecret')
            });

            return {
                userId: verified.sub,
                email: verified.email,
                claims: verified.claims
            };
        } catch {
            throw new UnauthorizedException('Invalid socket token');
        }
    }
}
