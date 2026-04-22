import { INestApplication } from '@nestjs/common';
import { bearerToken, TestTokenPayload } from './jwt';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');

let sequence = 0;

export const USERS = {
    owner: {
        sub: 'owner-user-id',
        email: 'owner@example.com',
        name: 'Owner User'
    },
    member: {
        sub: 'member-user-id',
        email: 'member@example.com',
        name: 'Member User'
    },
    outsider: {
        sub: 'outsider-user-id',
        email: 'outsider@example.com',
        name: 'Outside User'
    }
} satisfies Record<string, TestTokenPayload>;

export function uniqueSuffix(): string {
    sequence += 1;
    return `${Date.now().toString(36)}-${sequence}`;
}

export async function createWorkspace(
    app: INestApplication,
    user: TestTokenPayload = USERS.owner,
    overrides: Partial<{ name: string; subdomain: string; displayName: string }> = {}
) {
    const suffix = uniqueSuffix();
    const res = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', bearerToken(user))
        .send({
            name: `Acme ${suffix}`,
            subdomain: `acme-${suffix}`,
            displayName: user.name ?? user.email,
            ...overrides
        })
        .expect(201);

    return res.body as {
        id: string;
        name: string;
        slug: string;
        subdomain: string;
        ownerId: string;
        status: string;
    };
}

export async function getWorkspaceRole(
    app: INestApplication,
    workspaceId: string,
    roleName: string,
    user: TestTokenPayload = USERS.owner
) {
    const res = await request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/roles`)
        .set('Authorization', bearerToken(user))
        .expect(200);

    const role = (res.body as Array<{ id: string; name: string; permissions: string[] }>).find(
        (item) => item.name === roleName
    );

    if (!role) {
        throw new Error(`Role ${roleName} was not created`);
    }

    return role;
}

export function extractInviteToken(inviteUrl: string): string {
    const token = inviteUrl.split('/').pop();

    if (!token) {
        throw new Error(`No invite token in ${inviteUrl}`);
    }

    return token;
}

export async function inviteAndAcceptMember(
    app: INestApplication,
    workspaceId: string,
    member: TestTokenPayload = USERS.member,
    owner: TestTokenPayload = USERS.owner
) {
    const memberRole = await getWorkspaceRole(app, workspaceId, 'Member', owner);
    const inviteRes = await request(app.getHttpServer())
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Authorization', bearerToken(owner))
        .send({ email: member.email, roleIds: [memberRole.id] })
        .expect(201);

    const token = extractInviteToken(inviteRes.body.inviteUrl);

    await request(app.getHttpServer())
        .post(`/api/invitations/${token}/accept`)
        .set('Authorization', bearerToken(member))
        .send({ displayName: member.name ?? member.email })
        .expect(201);

    return {
        memberRole,
        invitation: inviteRes.body,
        token
    };
}
