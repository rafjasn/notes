import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NotesInfraStack } from '../lib/infra-stack';
import { NotesServicesStack } from '../lib/services-stack';

loadRepoEnv(resolve(__dirname, '../../../.env'));

const app = new cdk.App();
const requireDeployAppEnv = process.env.CDK_REQUIRE_APP_ENV === 'true';

const env: cdk.Environment = {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1'
};

const corsOrigin: string =
    app.node.tryGetContext('corsOrigin') ??
    process.env.CORS_ORIGIN ??
    (requireDeployAppEnv ? '' : 'http://localhost:3000');

if (!corsOrigin) {
    throw new Error(
        'Missing corsOrigin. Pass --context corsOrigin=https://... or set CORS_ORIGIN env var.'
    );
}

const frontendOrigin = corsOrigin.replace(/\/$/, '');

const mailFrom: string =
    app.node.tryGetContext('mailFrom') ??
    process.env.MAIL_FROM ??
    (requireDeployAppEnv ? '' : 'no-reply@example.com');

if (!mailFrom) {
    throw new Error('Missing MAIL_FROM. Set a verified SES sender address for production email.');
}

const cognitoDomainPrefix: string =
    app.node.tryGetContext('cognitoDomainPrefix') ??
    process.env.COGNITO_DOMAIN_PREFIX ??
    (requireDeployAppEnv ? '' : 'notes-local-dev');

if (!cognitoDomainPrefix) {
    throw new Error(
        'Missing COGNITO_DOMAIN_PREFIX. Use a globally unique Cognito Hosted UI domain prefix.'
    );
}

const callbackUrls = csvOrDefault(
    app.node.tryGetContext('oauthCallbackUrls') ?? process.env.OAUTH_CALLBACK_URLS,
    [`${frontendOrigin}/api/bff/auth/oauth/callback`]
);
const logoutUrls = csvOrDefault(
    app.node.tryGetContext('oauthLogoutUrls') ?? process.env.OAUTH_LOGOUT_URLS,
    [`${frontendOrigin}/login`]
);

const infra = new NotesInfraStack(app, 'NotesInfraStack', {
    env,
    description: 'Notes — stateful resources (VPC, ECR, KMS, Cognito, SNS/SQS, DynamoDB)',
    removalPolicy:
        app.node.tryGetContext('removalPolicy') === 'destroy'
            ? cdk.RemovalPolicy.DESTROY
            : cdk.RemovalPolicy.RETAIN,
    auth: {
        callbackUrls,
        logoutUrls,
        domainPrefix: cognitoDomainPrefix
    }
});

new NotesServicesStack(app, 'NotesServicesStack', {
    env,
    description: 'Notes — ECS Fargate services and ALB',
    infra,
    imageTag: app.node.tryGetContext('imageTag') ?? 'latest',
    corsOrigin: frontendOrigin,
    mailFrom
});

function csvOrDefault(value: unknown, fallback: string[]): string[] {
    if (typeof value !== 'string' || !value.trim()) {
        return fallback;
    }

    const items = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    return items.length ? items : fallback;
}

function loadRepoEnv(envPath: string): void {
    if (!existsSync(envPath)) {
        return;
    }

    for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const line = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
        const eq = line.indexOf('=');

        if (eq === -1) {
            continue;
        }

        const key = line.slice(0, eq).trim();

        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) {
            continue;
        }

        let value = line.slice(eq + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value.replace(/\\n/g, '\n');
    }
}
