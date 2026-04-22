import { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { clearDatabase, createE2eApp } from './helpers/app';
import { createWorkspace, USERS } from './helpers/fixtures';
import { bearerToken } from './helpers/jwt';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');

describe('Realtime authorization (e2e, requires MongoDB)', () => {
    let app: INestApplication;
    let connection: Connection;

    beforeAll(async () => {
        ({ app, connection } = await createE2eApp({ mockRealtimeService: false }));
    });

    afterEach(async () => {
        await clearDatabase(connection);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app?.close();
        await connection?.close(true);
    });

    describe('POST /api/realtime/authorize', () => {
        it('requires a valid bearer token', async () => {
            await request(app.getHttpServer())
                .post('/api/realtime/authorize')
                .send({ channel: 'public:system' })
                .expect(401);
        });

        it('allows authenticated public and own private-user channels', async () => {
            const publicRes = await request(app.getHttpServer())
                .post('/api/realtime/authorize')
                .set('Authorization', bearerToken(USERS.owner))
                .send({ channel: 'public:system' })
                .expect(201);

            expect(publicRes.body).toEqual({
                allowed: true,
                channel: 'public:system'
            });

            const privateRes = await request(app.getHttpServer())
                .post('/api/realtime/authorize')
                .set('Authorization', bearerToken(USERS.owner))
                .send({ channel: `private-user:${USERS.owner.sub}:notifications` })
                .expect(201);

            expect(privateRes.body).toEqual({
                allowed: true,
                channel: `private-user:${USERS.owner.sub}:notifications`
            });

            await request(app.getHttpServer())
                .post('/api/realtime/authorize')
                .set('Authorization', bearerToken(USERS.owner))
                .send({ channel: `private-user:${USERS.member.sub}:notifications` })
                .expect(403);
        });

        it('allows workspace note channels only for members with notes read permission', async () => {
            const workspace = await createWorkspace(app);
            const channel = `private-workspace:${workspace.id}:notes`;

            const ownerRes = await request(app.getHttpServer())
                .post('/api/realtime/authorize')
                .set('Authorization', bearerToken(USERS.owner))
                .send({ channel })
                .expect(201);

            expect(ownerRes.body).toMatchObject({
                allowed: true,
                channel,
                workspaceId: workspace.id,
                roleIds: expect.any(Array)
            });

            await request(app.getHttpServer())
                .post('/api/realtime/authorize')
                .set('Authorization', bearerToken(USERS.outsider))
                .send({ channel })
                .expect(403);
        });

        it('validates the authorization payload', async () => {
            await request(app.getHttpServer())
                .post('/api/realtime/authorize')
                .set('Authorization', bearerToken(USERS.owner))
                .send({})
                .expect(400);
        });
    });
});
