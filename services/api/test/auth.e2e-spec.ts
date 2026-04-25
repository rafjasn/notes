import { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import {
    clearDatabase,
    createE2eApp,
    createMockAuthProvider,
    MockAuthProvider,
    MockMailService
} from './helpers/app';
import { bearerToken } from './helpers/jwt';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');

describe('Auth (e2e)', () => {
    let app: INestApplication;
    let connection: Connection;
    let mockAuthProvider: MockAuthProvider;
    let mockMailService: MockMailService;

    beforeAll(async () => {
        ({ app, connection, mockAuthProvider, mockMailService } = await createE2eApp());
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

        it('does not reactivate a disabled user during provider login', async () => {
            const loginProvider = createMockAuthProvider({
                sub: 'disabled-user-id',
                email: 'disabled@example.com',
                name: 'Disabled User'
            });
            mockAuthProvider.login.mockImplementation(loginProvider.login);

            await connection.collection('users').insertOne({
                providerId: 'disabled-user-id',
                provider: 'keycloak',
                email: 'disabled@example.com',
                name: 'Disabled User',
                status: 'disabled',
                mfaEnabled: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({
                    email: 'disabled@example.com',
                    password: 'password123'
                })
                .expect(401);

            const user = await connection
                .collection('users')
                .findOne({ providerId: 'disabled-user-id' });
            expect(user?.status).toBe('disabled');
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

        it('rejects protected routes and refreshes after an account is disabled', async () => {
            const registered = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    email: 'disabled-after-login@example.com',
                    password: 'password123',
                    name: 'Disabled Later'
                })
                .expect(201);

            await connection
                .collection('users')
                .updateOne({ providerId: 'test-user-id' }, { $set: { status: 'disabled' } });

            await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${registered.body.accessToken}`)
                .expect(401);

            await request(app.getHttpServer())
                .post('/api/auth/refresh')
                .send({ refreshToken: registered.body.refreshToken })
                .expect(401);
        });
    });

    describe('email OTP', () => {
        it('stores the challenge durably and consumes it once', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    email: 'otp@example.com',
                    password: 'password123',
                    name: 'Otp User'
                })
                .expect(201);

            const initiated = await request(app.getHttpServer())
                .post('/api/auth/otp/email')
                .send({ email: 'otp@example.com' })
                .expect(201);

            const code = mockMailService.sendOtp.mock.calls[0]?.[1];
            expect(code).toMatch(/^\d{6}$/);

            const verified = await request(app.getHttpServer())
                .post('/api/auth/otp/email/verify')
                .send({ challengeId: initiated.body.challengeId, code })
                .expect(201);

            expect(verified.body).toMatchObject({
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
                email: 'otp@example.com'
            });

            await request(app.getHttpServer())
                .post('/api/auth/otp/email/verify')
                .send({ challengeId: initiated.body.challengeId, code })
                .expect(401);
        });
    });
});
