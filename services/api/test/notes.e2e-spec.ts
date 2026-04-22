import { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { clearDatabase, createE2eApp, MockRealtimeService } from './helpers/app';
import { createWorkspace, inviteAndAcceptMember, uniqueSuffix, USERS } from './helpers/fixtures';
import { bearerToken } from './helpers/jwt';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');

describe('Notes API (e2e, requires MongoDB)', () => {
    let app: INestApplication;
    let connection: Connection;
    let mockRealtimeService: MockRealtimeService;

    beforeAll(async () => {
        ({ app, connection, mockRealtimeService } = await createE2eApp());
    });

    afterEach(async () => {
        await clearDatabase(connection);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app?.close();
        await connection?.close(true);
    });

    describe('auth and validation', () => {
        it('rejects note requests without a token', async () => {
            const workspace = await createWorkspace(app);

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes`)
                .expect(401);
        });

        it('returns 400 for invalid note ids and note payloads', async () => {
            const workspace = await createWorkspace(app);

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes/not-a-mongo-id`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(400);

            await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/notes`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({ content: 'A note without a title' })
                .expect(400);
        });
    });

    describe('CRUD, soft delete, and versions', () => {
        it('creates, lists, updates, versions, and soft-deletes notes', async () => {
            const workspace = await createWorkspace(app);

            const created = await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/notes`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({ title: 'Launch plan', content: 'Initial draft' })
                .expect(201);

            expect(created.body).toMatchObject({
                id: expect.any(String),
                workspaceId: workspace.id,
                userId: USERS.owner.sub,
                userEmail: USERS.owner.email,
                title: 'Launch plan',
                content: 'Initial draft',
                version: 1,
                status: 'active',
                encrypted: false
            });
            expect(mockRealtimeService.trigger).toHaveBeenCalledWith(
                `private-workspace:${workspace.id}:notes`,
                'note.created',
                expect.objectContaining({ id: created.body.id })
            );

            const listed = await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(listed.body).toHaveLength(1);
            expect(listed.body[0].id).toBe(created.body.id);

            const fetched = await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes/${created.body.id}`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(fetched.body.title).toBe('Launch plan');

            const updated = await request(app.getHttpServer())
                .patch(`/api/workspaces/${workspace.id}/notes/${created.body.id}`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({ title: 'Launch plan v2', content: 'Ready for review' })
                .expect(200);

            expect(updated.body).toMatchObject({
                id: created.body.id,
                title: 'Launch plan v2',
                content: 'Ready for review',
                version: 2,
                updatedByUserId: USERS.owner.sub,
                updatedByUserEmail: USERS.owner.email
            });
            expect(mockRealtimeService.trigger).toHaveBeenCalledWith(
                `private-workspace:${workspace.id}:notes`,
                'note.updated',
                expect.objectContaining({ id: created.body.id, version: 2 })
            );

            const versionsAfterUpdate = await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes/${created.body.id}/versions`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(versionsAfterUpdate.body).toHaveLength(1);
            expect(versionsAfterUpdate.body[0]).toMatchObject({
                noteId: created.body.id,
                version: 1,
                title: 'Launch plan',
                content: 'Initial draft',
                changeType: 'updated'
            });

            const deleted = await request(app.getHttpServer())
                .delete(`/api/workspaces/${workspace.id}/notes/${created.body.id}`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(deleted.body).toMatchObject({
                deleted: true,
                note: {
                    id: created.body.id,
                    status: 'deleted',
                    deletedByUserId: USERS.owner.sub,
                    deletedAt: expect.any(String)
                }
            });
            expect(mockRealtimeService.trigger).toHaveBeenCalledWith(
                `private-workspace:${workspace.id}:notes`,
                'note.deleted',
                expect.objectContaining({ id: created.body.id, workspaceId: workspace.id })
            );

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes/${created.body.id}`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(404);

            const deletedList = await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes/deleted`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(deletedList.body).toHaveLength(1);
            expect(deletedList.body[0]).toMatchObject({
                id: created.body.id,
                status: 'deleted'
            });

            const versionsAfterDelete = await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes/${created.body.id}/versions`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(versionsAfterDelete.body).toHaveLength(2);
            expect(versionsAfterDelete.body).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ version: 1, changeType: 'updated' }),
                    expect.objectContaining({ version: 2, changeType: 'deleted' })
                ])
            );
        });

        it('stores encrypted note payloads without requiring plaintext title', async () => {
            const workspace = await createWorkspace(app);

            const res = await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/notes`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({
                    encryptedTitle: 'ZW5jcnlwdGVkLXRpdGxl',
                    titleIv: 'dGl0bGUtaXY=',
                    content: 'ZW5jcnlwdGVkLWJvZHk=',
                    encryptedDataKey: 'ZW5jcnlwdGVkLWtleQ==',
                    iv: 'Ym9keS1pdg==',
                    encrypted: true
                })
                .expect(201);

            expect(res.body).toMatchObject({
                workspaceId: workspace.id,
                encryptedTitle: 'ZW5jcnlwdGVkLXRpdGxl',
                titleIv: 'dGl0bGUtaXY=',
                content: 'ZW5jcnlwdGVkLWJvZHk=',
                encryptedDataKey: 'ZW5jcnlwdGVkLWtleQ==',
                iv: 'Ym9keS1pdg==',
                encrypted: true
            });
            expect(res.body.title).toBeUndefined();
        });
    });

    describe('workspace scoping and permissions', () => {
        it('keeps notes scoped to their workspace', async () => {
            const workspaceA = await createWorkspace(app, USERS.owner, {
                name: 'Workspace A',
                subdomain: `notes-a-${uniqueSuffix()}`
            });
            const workspaceB = await createWorkspace(app, USERS.owner, {
                name: 'Workspace B',
                subdomain: `notes-b-${uniqueSuffix()}`
            });

            const note = await request(app.getHttpServer())
                .post(`/api/workspaces/${workspaceA.id}/notes`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({ title: 'Workspace A only', content: 'Private to A' })
                .expect(201);

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspaceB.id}/notes/${note.body.id}`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(404);
        });

        it('allows member read/write permissions but denies deleted notes and history access', async () => {
            const workspace = await createWorkspace(app);
            await inviteAndAcceptMember(app, workspace.id, USERS.member, USERS.owner);

            const note = await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/notes`)
                .set('Authorization', bearerToken(USERS.member))
                .send({ title: 'Member note', content: 'Created by member' })
                .expect(201);

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes`)
                .set('Authorization', bearerToken(USERS.member))
                .expect(200);

            await request(app.getHttpServer())
                .delete(`/api/workspaces/${workspace.id}/notes/${note.body.id}`)
                .set('Authorization', bearerToken(USERS.member))
                .expect(403);

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes/deleted`)
                .set('Authorization', bearerToken(USERS.member))
                .expect(403);

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes/${note.body.id}/versions`)
                .set('Authorization', bearerToken(USERS.member))
                .expect(403);
        });

        it('denies all note access to users outside the workspace', async () => {
            const workspace = await createWorkspace(app);

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/notes`)
                .set('Authorization', bearerToken(USERS.outsider))
                .expect(403);
        });
    });
});
