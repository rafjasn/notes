import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsException
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { parseChannel } from '@notes/shared';
import { AuthTokenService } from './auth-token.service';
import { SubscriptionAuthorizerService } from './subscription-authorizer.service';
import type { SubscribePayload } from './fanout.types';

type AuthedSocket = Socket & {
    data: Socket['data'] & {
        accessToken?: string;
        user?: {
            userId: string;
            email: string;
            claims?: Record<string, unknown>;
        };
    };
};

@WebSocketGateway({
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
})
export class FanoutGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly auth: AuthTokenService,
        private readonly authorizer: SubscriptionAuthorizerService
    ) {}

    async handleConnection(client: AuthedSocket): Promise<void> {
        const token = this.readToken(client);

        if (!token) {
            client.disconnect(true);

            return;
        }

        try {
            client.data.accessToken = token;
            client.data.user = await this.auth.verify(token);
        } catch {
            client.disconnect(true);
        }
    }

    handleDisconnect(_client: AuthedSocket): void {
        // Socket.IO automatically leaves rooms on disconnect.
    }

    @SubscribeMessage('subscribe')
    async subscribe(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() payload: SubscribePayload
    ): Promise<{ subscribed: string }> {
        if (!client.data.user || !client.data.accessToken) {
            throw new WsException('Unauthenticated');
        }

        try {
            parseChannel(payload.channel);
            await this.authorizer.authorize(client.data.accessToken, payload.channel);
            await client.join(payload.channel);

            return { subscribed: payload.channel };
        } catch {
            throw new WsException('Not authorized for channel');
        }
    }

    @SubscribeMessage('unsubscribe')
    async unsubscribe(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() payload: SubscribePayload
    ): Promise<{ unsubscribed: string }> {
        await client.leave(payload.channel);

        return { unsubscribed: payload.channel };
    }

    broadcast(channel: string, event: string, payload: unknown): void {
        this.server.to(channel).emit(event, payload);
    }

    private readToken(client: Socket): string | undefined {
        const authToken = client.handshake.auth?.token;

        if (typeof authToken === 'string') {
            return authToken;
        }

        const authorization = client.handshake.headers.authorization;
        if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
            return authorization.slice('Bearer '.length);
        }

        const cookie = client.handshake.headers.cookie;
        if (typeof cookie === 'string') {
            const token = cookie
                .split(';')
                .map((part) => part.trim())
                .find((part) => part.startsWith('notes_access_token='))
                ?.slice('notes_access_token='.length);

            if (token) {
                return decodeURIComponent(token);
            }
        }

        return undefined;
    }
}
