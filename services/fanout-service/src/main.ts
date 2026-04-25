import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './fanout/redis-io.adapter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);
    const redisIoAdapter = new RedisIoAdapter(app, config);

    await redisIoAdapter.connect();
    app.useWebSocketAdapter(redisIoAdapter);

    app.enableCors({
        origin: config.get<string>('fanout.corsOrigin', '*'),
        credentials: false
    });

    await app.listen(config.get<number>('fanout.port', 3000));
}

void bootstrap();
