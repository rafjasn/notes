import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);
    const port = config.get<number>('app.port', 3000);
    const corsOrigin = config.get<string>('app.corsOrigin', 'http://localhost:3001');

    app.enableCors({
        origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
            if (
                !origin ||
                origin === corsOrigin ||
                /^https?:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/i.test(origin)
            ) {
                return callback(null, true);
            }

            return callback(new Error(`Origin ${origin} is not allowed by CORS`));
        },
        credentials: true
    });

    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(
        new LoggingInterceptor(),
        new ClassSerializerInterceptor(app.get(Reflector))
    );
    app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );

    if (process.env.NODE_ENV !== 'production') {
        const swaggerConfig = new DocumentBuilder()
            .setTitle('Notes SaaS API')
            .setDescription(
                'Multi-tenant SaaS API with RBAC, invitations, realtime notes, and KMS envelope encryption.'
            )
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
    }

    app.enableShutdownHooks();

    await app.listen(port);
}

void bootstrap();
