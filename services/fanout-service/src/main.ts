import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);

    app.enableCors({
        origin: config.get<string>('fanout.corsOrigin', '*'),
        credentials: false
    });

    await app.listen(config.get<number>('fanout.port', 3000));
}

void bootstrap();
