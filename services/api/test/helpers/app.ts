import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { MailService } from '../../src/modules/mail/mail.service';
import { RealtimeService } from '../../src/modules/realtime/realtime.service';
import { SmsService } from '../../src/modules/auth/sms.service';
import { AUTH_PROVIDER } from '../../src/modules/auth/providers/auth-provider.factory';
import type { AuthProvider, AuthTokens } from '../../src/modules/auth/auth-provider.interface';
import { signTestToken, TEST_JWT_SECRET } from './jwt';

export interface TestProviderUser {
    sub: string;
    email: string;
    name?: string;
}

export type MockAuthProvider = jest.Mocked<AuthProvider>;
export type MockMailService = {
    sendOtp: jest.Mock<Promise<void>, [string, string]>;
    sendMagicLink: jest.Mock<Promise<void>, [string, string]>;
    sendPasswordReset: jest.Mock<Promise<void>, [string, string]>;
    sendInvitation: jest.Mock<Promise<void>, [string, string, string]>;
};
export type MockSmsService = {
    sendOtp: jest.Mock<Promise<void>, [string, string]>;
};
export type MockRealtimeService = {
    trigger: jest.Mock<
        Promise<{ queued: boolean; channel: string; event: string }>,
        [string, string, unknown]
    >;
};

export interface E2eTestApp {
    app: INestApplication;
    module: TestingModule;
    connection: Connection;
    mockAuthProvider: MockAuthProvider;
    mockMailService: MockMailService;
    mockSmsService: MockSmsService;
    mockRealtimeService?: MockRealtimeService;
}

export interface CreateE2eAppOptions {
    mockAuthProvider?: MockAuthProvider;
    mockMailService?: MockMailService;
    mockSmsService?: MockSmsService;
    mockRealtimeService?: MockRealtimeService | false;
}

const DEFAULT_PROVIDER_USER: TestProviderUser = {
    sub: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
};

const noopLogger = {
    log: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    verbose: () => {}
};

const E2E_MONGO_BASE_URI_ENV = 'NOTES_E2E_MONGO_BASE_URI';

function workerScopedMongoUri(baseUri: string): string {
    const workerId = process.env.JEST_WORKER_ID ?? '1';
    const scope = `worker-${workerId}`;
    const queryStart = baseUri.indexOf('?');
    const uriWithoutQuery = queryStart === -1 ? baseUri : baseUri.slice(0, queryStart);
    const query = queryStart === -1 ? '' : baseUri.slice(queryStart);
    const authorityStart = uriWithoutQuery.indexOf('://');

    if (authorityStart === -1) {
        return baseUri;
    }

    const pathStart = uriWithoutQuery.indexOf('/', authorityStart + 3);

    if (pathStart === -1) {
        return `${uriWithoutQuery}/notes-e2e-${scope}${query}`;
    }

    const prefix = uriWithoutQuery.slice(0, pathStart);
    const database = uriWithoutQuery.slice(pathStart + 1) || 'notes-e2e';

    return `${prefix}/${database}-${scope}${query}`;
}

function configureTestEnvironment() {
    const defaultMongoUri = 'mongodb://127.0.0.1:27017/notes-e2e?serverSelectionTimeoutMS=5000';
    const baseMongoUri =
        process.env[E2E_MONGO_BASE_URI_ENV] ?? process.env.MONGO_URI ?? defaultMongoUri;

    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    process.env[E2E_MONGO_BASE_URI_ENV] = baseMongoUri;
    process.env.MONGO_URI = workerScopedMongoUri(baseMongoUri);
    process.env.SMTP_HOST = '';
}

function applyGlobalSetup(app: INestApplication) {
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(
        new LoggingInterceptor(),
        new ClassSerializerInterceptor(app.get(Reflector))
    );
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true
        })
    );
}

export function authTokensFor(user: TestProviderUser): AuthTokens {
    const token = signTestToken({
        sub: user.sub,
        email: user.email,
        name: user.name
    });

    return {
        access_token: token,
        id_token: token,
        refresh_token: `${user.sub}-provider-refresh-token`,
        expires_in: 3600
    };
}

export function createMockAuthProvider(
    user: TestProviderUser = DEFAULT_PROVIDER_USER
): MockAuthProvider {
    return {
        register: jest.fn().mockResolvedValue(user.sub),
        login: jest.fn().mockResolvedValue(authTokensFor(user)),
        refresh: jest.fn().mockResolvedValue(authTokensFor(user)),
        changePassword: jest.fn().mockResolvedValue(undefined),
        getOAuthUrl: jest
            .fn()
            .mockImplementation((redirectUri: string, state: string) =>
                Promise.resolve(`${redirectUri}?state=${state}&provider=mock`)
            ),
        handleOAuthCallback: jest.fn().mockResolvedValue(authTokensFor(user))
    };
}

export function createMockMailService(): MockMailService {
    return {
        sendOtp: jest.fn().mockResolvedValue(undefined),
        sendMagicLink: jest.fn().mockResolvedValue(undefined),
        sendPasswordReset: jest.fn().mockResolvedValue(undefined),
        sendInvitation: jest.fn().mockResolvedValue(undefined)
    };
}

export function createMockSmsService(): MockSmsService {
    return {
        sendOtp: jest.fn().mockResolvedValue(undefined)
    };
}

export function createMockRealtimeService(): MockRealtimeService {
    return {
        trigger: jest
            .fn()
            .mockImplementation((channel: string, event: string) =>
                Promise.resolve({ queued: true, channel, event })
            )
    };
}

export async function createE2eApp(options: CreateE2eAppOptions = {}): Promise<E2eTestApp> {
    configureTestEnvironment();

    const mockAuthProvider = options.mockAuthProvider ?? createMockAuthProvider();
    const mockMailService = options.mockMailService ?? createMockMailService();
    const mockSmsService = options.mockSmsService ?? createMockSmsService();
    const mockRealtimeService =
        options.mockRealtimeService === false
            ? undefined
            : (options.mockRealtimeService ?? createMockRealtimeService());

    const builder = Test.createTestingModule({ imports: [AppModule] }).setLogger(noopLogger);

    builder.overrideProvider(AUTH_PROVIDER).useValue(mockAuthProvider);
    builder.overrideProvider(MailService).useValue(mockMailService);
    builder.overrideProvider(SmsService).useValue(mockSmsService);

    if (mockRealtimeService) {
        builder.overrideProvider(RealtimeService).useValue(mockRealtimeService);
    }

    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication();
    applyGlobalSetup(app);
    await app.init();
    const connection = app.get<Connection>(getConnectionToken());
    await clearDatabase(connection);

    return {
        app,
        module: moduleRef,
        connection,
        mockAuthProvider,
        mockMailService,
        mockSmsService,
        mockRealtimeService
    };
}

export async function clearDatabase(connection?: Connection): Promise<void> {
    if (!connection?.db) return;

    const collections = await connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
