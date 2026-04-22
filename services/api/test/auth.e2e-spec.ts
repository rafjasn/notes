import { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import {
    clearDatabase,
    createE2eApp,
    createMockAuthProvider,
    MockAuthProvider
} from './helpers/app';
import { bearerToken } from './helpers/jwt';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');

describe('Auth (e2e)', () => {
    let app: INestApplication;
    let connection: Connection;
    let mockAuthProvider: MockAuthProvider;

    beforeAll(async () => {
        ({ app, connection, mockAuthProvider } = await createE2eApp());
    });

    afterEach(async () => {
        await clearDatabase(connection);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app?.close();
        await connection?.close(true);
    });

    describe('POST /api/auth/register', () => {
        it('registers a user, persists the profile, and issues session tokens', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    email: 'New.User@Example.com',
                    password: 'password123',
                    name: 'New User'
                })
                .expect(201);

            expect(res.body).toMatchObject({
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
                userId: 'test-user-id',
                email: 'new.user@example.com'
            });
            expect(mockAuthProvider.register).toHaveBeenCalledWith(
                'new.user@example.com',
                'password123',
                'New User'
            );

            const me = await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${res.body.accessToken}`)
                .expect(200);

            expect(me.body).toMatchObject({
                userId: 'test-user-id',
                email: 'new.user@example.com',
                name: 'New User',
                status: 'active',
                mfaEnabled: false
            });
        });

        it('returns 400 for invalid registration input', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({ email: 'not-an-email', password: 'short' })
                .expect(400);
        });
    });

    describe('POST /api/auth/login', () => {
        it('normalizes credentials, upserts the provider user, and returns session tokens', async () => {
            const loginProvider = createMockAuthProvider({
                sub: 'provider-user-1',
                email: 'provider@example.com',
                name: 'Provider User'
            });
            mockAuthProvider.login.mockImplementation(loginProvider.login);

            const res = await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({
                    email: 'Provider@Example.com',
                    password: 'password123'
                })
                .expect(201);

            expect(res.body).toMatchObject({
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
                userId: 'provider-user-1',
                email: 'provider@example.com'
            });
            expect(mockAuthProvider.login).toHaveBeenCalledWith(
                'provider@example.com',
                'password123'
            );
        });

        it('returns 400 when required credentials are missing', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: 'user@example.com' })
                .expect(400);
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('exchanges a refresh token for a new access token', async () => {
            const login = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    email: 'refresh@example.com',
                    password: 'password123',
                    name: 'Refresh User'
                })
                .expect(201);

            const res = await request(app.getHttpServer())
                .post('/api/auth/refresh')
                .send({ refreshToken: login.body.refreshToken })
                .expect(201);

            expect(res.body).toMatchObject({
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
                userId: 'test-user-id',
                email: 'refresh@example.com'
            });
        });

        it('rejects access tokens on the refresh endpoint', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/refresh')
                .send({
                    refreshToken: bearerToken({
                        sub: 'test-user-id',
                        email: 'refresh@example.com'
                    }).slice('Bearer '.length)
                })
                .expect(401);
        });
    });

    describe('GET/PATCH /api/auth/me', () => {
        it('rejects requests without a valid bearer token', async () => {
            await request(app.getHttpServer()).get('/api/auth/me').expect(401);
            await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Authorization', 'Bearer not.a.jwt')
                .expect(401);
        });

        it('updates the current user profile', async () => {
            const registered = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    email: 'profile@example.com',
                    password: 'password123',
                    name: 'Profile User'
                })
                .expect(201);
            const authorization = `Bearer ${registered.body.accessToken}`;

            const res = await request(app.getHttpServer())
                .patch('/api/auth/me')
                .set('Authorization', authorization)
                .send({ name: 'Updated Profile', phone: '+12125550123' })
                .expect(200);

            expect(res.body).toMatchObject({
                userId: 'test-user-id',
                email: 'profile@example.com',
                name: 'Updated Profile',
                phone: '12125550123',
                status: 'active',
                mfaEnabled: false
            });
        });
    });
});
