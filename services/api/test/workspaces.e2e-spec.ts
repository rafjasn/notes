import { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { clearDatabase, createE2eApp, MockMailService } from './helpers/app';
import {
    createWorkspace,
    extractInviteToken,
    getWorkspaceRole,
    uniqueSuffix,
    USERS
} from './helpers/fixtures';
import { bearerToken } from './helpers/jwt';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');

describe('Workspaces and invitations (e2e)', () => {
    let app: INestApplication;
    let connection: Connection;
    let mockMailService: MockMailService;

    beforeAll(async () => {
        ({ app, connection, mockMailService } = await createE2eApp());
    });

    afterEach(async () => {
        await clearDatabase(connection);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app?.close();
        await connection?.close(true);
    });

    describe('workspace auth and lifecycle', () => {
        it('rejects workspace requests without a token', async () => {
            await request(app.getHttpServer()).get('/api/workspaces').expect(401);
            await request(app.getHttpServer())
                .post('/api/workspaces')
                .send({ name: 'No Token' })
                .expect(401);
        });

        it('creates a workspace with owner membership and default roles', async () => {
            const workspace = await createWorkspace(app, USERS.owner, {
                name: 'Acme Labs',
                subdomain: `labs-${uniqueSuffix()}`,
                displayName: 'Rafal Owner'
            });

            expect(workspace).toMatchObject({
                id: expect.any(String),
                name: 'Acme Labs',
                ownerId: USERS.owner.sub,
                status: 'active'
            });

            const mine = await request(app.getHttpServer())
                .get('/api/workspaces')
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(mine.body).toHaveLength(1);
            expect(mine.body[0]).toMatchObject({
                displayName: 'Rafal Owner',
                workspace: {
                    id: workspace.id,
                    name: 'Acme Labs'
                }
            });

            const members = await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/members`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(members.body).toHaveLength(1);
            expect(members.body[0]).toMatchObject({
                userId: USERS.owner.sub,
                email: USERS.owner.email,
                displayName: 'Rafal Owner',
                status: 'active'
            });
            expect(members.body[0].roles.map((role: { name: string }) => role.name)).toContain(
                'Admin'
            );
        });

        it('returns 409 when a workspace subdomain is already used', async () => {
            const subdomain = `dupe-${uniqueSuffix()}`;
            await createWorkspace(app, USERS.owner, { name: 'First Workspace', subdomain });

            await request(app.getHttpServer())
                .post('/api/workspaces')
                .set('Authorization', bearerToken(USERS.owner))
                .send({ name: 'Second Workspace', subdomain })
                .expect(409);
        });

        it('prevents outsiders from reading workspace members', async () => {
            const workspace = await createWorkspace(app);

            await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/members`)
                .set('Authorization', bearerToken(USERS.outsider))
                .expect(403);
        });
    });

    describe('roles', () => {
        it('lists system roles and lets admins create custom roles', async () => {
            const workspace = await createWorkspace(app);

            const roles = await request(app.getHttpServer())
                .get(`/api/workspaces/${workspace.id}/roles`)
                .set('Authorization', bearerToken(USERS.owner))
                .expect(200);

            expect(roles.body.map((role: { name: string }) => role.name)).toEqual(
                expect.arrayContaining([
                    'Admin',
                    'Member',
                    'Deleted Notes Viewer',
                    'Note History Viewer'
                ])
            );

            const editor = await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/roles`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({
                    name: 'Editor',
                    description: 'Can read and write notes',
                    permissions: ['notes:read', 'notes:write']
                })
                .expect(201);

            expect(editor.body).toMatchObject({
                id: expect.any(String),
                name: 'Editor',
                permissions: ['notes:read', 'notes:write'],
                system: false
            });

            await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/roles`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({
                    name: 'Editor',
                    permissions: ['notes:read']
                })
                .expect(409);

            await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/roles`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({
                    name: 'Invalid',
                    permissions: ['*']
                })
                .expect(400);
        });
    });

    describe('KMS authorization', () => {
        it('allows only members with the operation-specific note permission', async () => {
            const workspace = await createWorkspace(app);

            await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/kms/authorize`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({ operation: 'generate' })
                .expect(201);

            await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/kms/authorize`)
                .set('Authorization', bearerToken(USERS.outsider))
                .send({ operation: 'decrypt' })
                .expect(403);

            const viewerRole = await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/roles`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({
                    name: 'KMS Viewer',
                    permissions: ['notes:read']
                })
                .expect(201);

            const invite = await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/invitations`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({ email: USERS.member.email, roleIds: [viewerRole.body.id] })
                .expect(201);

            const token = extractInviteToken(invite.body.inviteUrl);
            await request(app.getHttpServer())
                .post(`/api/invitations/${token}/accept`)
                .set('Authorization', bearerToken(USERS.member))
                .send({ displayName: USERS.member.name })
                .expect(201);

            await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/kms/authorize`)
                .set('Authorization', bearerToken(USERS.member))
                .send({ operation: 'decrypt' })
                .expect(201);

            await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/kms/authorize`)
                .set('Authorization', bearerToken(USERS.member))
                .send({ operation: 'generate' })
                .expect(403);
        });
    });

    describe('invitations', () => {
        it('sends, previews, and accepts an invitation for a matching email', async () => {
            const workspace = await createWorkspace(app);
            const memberRole = await getWorkspaceRole(app, workspace.id, 'Member');

            const invite = await request(app.getHttpServer())
                .post(`/api/workspaces/${workspace.id}/invitations`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({ email: 'Member@Example.com', roleIds: [memberRole.id] })
                .expect(201);

            expect(invite.body).toMatchObject({
                invitationId: expect.any(String),
                email: USERS.member.email,
                roleIds: [memberRole.id],
                inviteUrl: expect.stringContaining('/invite/')
            });
            expect(mockMailService.sendInvitation).toHaveBeenCalledWith(
                USERS.member.email,
                workspace.name,
                invite.body.inviteUrl
            );

            const token = extractInviteToken(invite.body.inviteUrl);
            const preview = await request(app.getHttpServer())
                .get(`/api/invitations/${token}/preview`)
                .expect(200);

            expect(preview.body).toMatchObject({
                workspaceName: workspace.name,
                email: USERS.member.email,
                expiresAt: expect.any(String)
            });

            await request(app.getHttpServer())
                .post(`/api/invitations/${token}/accept`)
                .set('Authorization', bearerToken(USERS.outsider))
                .send({ displayName: 'Wrong Person' })
                .expect(403);

            const accepted = await request(app.getHttpServer())
                .post(`/api/invitations/${token}/accept`)
                .set('Authorization', bearerToken(USERS.member))
                .send({ displayName: 'Member Display' })
                .expect(201);

            expect(accepted.body).toMatchObject({
                membershipId: expect.any(String),
                workspaceId: workspace.id,
                displayName: 'Member Display',
                roleIds: [memberRole.id]
            });

            const memberWorkspaces = await request(app.getHttpServer())
                .get('/api/workspaces')
                .set('Authorization', bearerToken(USERS.member))
                .expect(200);

            expect(memberWorkspaces.body).toHaveLength(1);
            expect(memberWorkspaces.body[0].workspace.id).toBe(workspace.id);
        });

        it('rejects invitations with roles from another workspace', async () => {
            const workspaceA = await createWorkspace(app, USERS.owner, {
                name: 'Workspace A',
                subdomain: `workspace-a-${uniqueSuffix()}`
            });
            const workspaceB = await createWorkspace(app, USERS.owner, {
                name: 'Workspace B',
                subdomain: `workspace-b-${uniqueSuffix()}`
            });
            const foreignRole = await getWorkspaceRole(app, workspaceB.id, 'Member');

            await request(app.getHttpServer())
                .post(`/api/workspaces/${workspaceA.id}/invitations`)
                .set('Authorization', bearerToken(USERS.owner))
                .send({ email: USERS.member.email, roleIds: [foreignRole.id] })
                .expect(400);
        });
    });
});
