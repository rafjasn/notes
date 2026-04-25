import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { ServerOptions } from 'socket.io';

type RedisClient = ReturnType<typeof createClient>;

export class RedisIoAdapter extends IoAdapter {
    private readonly logger = new Logger(RedisIoAdapter.name);
    private adapterConstructor?: ReturnType<typeof createAdapter>;
    private pubClient?: RedisClient;
    private subClient?: RedisClient;

    constructor(
        app: INestApplicationContext,
        private readonly config: ConfigService
    ) {
        super(app);
    }

    async connect(): Promise<void> {
        const redisUrl = this.config.get<string>('fanout.redis.url');

        if (!redisUrl) {
            this.logger.warn('REDIS_URL is not configured; Socket.IO broadcasts stay local');
            return;
        }

        this.pubClient = createClient({ url: redisUrl });
        this.subClient = this.pubClient.duplicate();

        this.pubClient.on('error', (error) =>
            this.logger.error(`Redis publish client error: ${error.message}`)
        );
        this.subClient.on('error', (error) =>
            this.logger.error(`Redis subscribe client error: ${error.message}`)
        );

        await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
        this.adapterConstructor = createAdapter(this.pubClient, this.subClient);

        this.logger.log('Socket.IO Redis adapter connected');
    }

    createIOServer(port: number, options?: ServerOptions) {
        const server = super.createIOServer(port, options);

        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }

        return server;
    }
}
