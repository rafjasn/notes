import { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { createE2eApp } from './helpers/app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');

describe('Health (e2e)', () => {
    let app: INestApplication;
    let connection: Connection;

    beforeAll(async () => {
        ({ app, connection } = await createE2eApp());
    });

    afterAll(async () => {
        await app?.close();
        await connection?.close(true);
    });

    describe('GET /api/health', () => {
        it('returns service health details', async () => {
            const res = await request(app.getHttpServer()).get('/api/health').expect(200);

            expect(res.body).toMatchObject({
                status: 'ok',
                service: 'notes-api',
                timestamp: expect.any(String)
            });
        });
    });
});
