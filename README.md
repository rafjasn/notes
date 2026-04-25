# Notes
[![CI](https://github.com/rafjasn/notes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rafjasn/notes/actions/workflows/ci.yml)

A full-stack multi-tenant encrypted notes platform built on AWS.

## Features

- Multi-tenant encrypted notes/workspace app with workspace subdomains for tenant routing
- Client-side AES-GCM encryption with per-note data keys, KMS-backed key wrapping, and workspace-scoped KMS encryption context
- Secure auth with Cognito OAuth in production, Keycloak locally, BFF-managed HttpOnly token storage, SES email, and SNS SMS verification flows
- Event-driven real-time synchronization: API publishes note events to SNS -> SQS -> fanout, and Redis-backed Socket.IO clustering broadcasts across fanout tasks
- Workspace collaboration with admin-defined roles, arbitrary permission strings, and invitation links with roles assigned up front
- API-authorized channel subscriptions: the fanout service asks the API whether a user may join a channel before allowing it

## Technologies

- **Frontend** — Next.js App Router, Tailwind CSS, TanStack Query, Socket.IO client
- **API** — NestJS, Passport JWT, Swagger, Mongoose
- **Fanout** — NestJS, Socket.IO, SQS long-polling, Redis pub/sub adapter
- **Storage** — MongoDB
- **Messaging** — SNS, SQS, Redis pub/sub
- **Auth** — Keycloak, AWS Cognito
- **Infrastructure** — AWS CDK v2, ECS Fargate, ALB, ECR, KMS, Cognito, SES, CloudWatch, Secrets Manager
- **Local dev** — LocalStack, Docker Compose, Mailhog

## Local setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4 with Compose v2
- Node.js 24 and npm ≥ 10 (only needed if running outside Docker)

### 1. Clone and configure

```bash
git clone <repo-url>
cd notes
cp .env.example .env
```

If you run the frontend outside Docker, also copy `frontend/.env.example` to `frontend/.env.local` and set `JWT_SECRET` to match the value in `.env`.

### 2. Start all services

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| API (via nginx) | http://localhost/api |
| Swagger UI | http://localhost/api/docs |
| API (direct) | http://localhost:3001/api |
| Fanout (direct) | http://localhost:3002 |
| Mailhog | http://localhost:8025 |
| Keycloak admin | http://localhost:8081 (admin / admin) |
| LocalStack | http://localhost:4566 |
| Redis | localhost:6379 |

LocalStack is initialised automatically — the KMS key (`alias/notes-local`), SNS topic, and SQS queues are all created on first start. Redis is used by the fanout service so Socket.IO broadcasts reach clients connected to any fanout instance.

### 3. Open the app

Go to http://localhost, register an account, and create a workspace. Invite other users from the workspace settings. Notes are encrypted in the browser when `NEXT_PUBLIC_KMS_KEY_ID` is set.

## Testing

End-to-end tests require MongoDB to be running:

```bash
docker compose up -d mongo
npm run test:e2e -w @notes/api
```

## Linting

```bash
# All workspaces
npm run lint

# Single service
npm run lint -w @notes/api
npm run lint -w @notes/fanout-service
npm run lint -w @notes/frontend
```

## Deployment

Infrastructure is managed with AWS CDK v2 from the `infrastructure/cdk` directory.

### Pre-requisites

Create required secrets in AWS Secrets Manager before the first deploy:

```bash
aws secretsmanager create-secret --name notes/mongo-uri \
  --secret-string "mongodb+srv://..."

aws secretsmanager create-secret --name notes/jwt-secret \
  --secret-string "$(openssl rand -hex 32)"
```

Verify the `MAIL_FROM` sender or domain in Amazon SES in the target region before deploying. The API uses SES for production email and SNS for SMS OTP delivery through the ECS task role.

The CDK stack creates the KMS key (`alias/notes`), Cognito user pool and Hosted UI domain, SNS/SQS resources, ElastiCache Redis for realtime fanout, and the three ECR repositories (`notes-api`, `notes-fanout`, `notes-frontend`) automatically on first deploy.

### Required environment variables

| Variable | Required for | Description |
|---|---|---|
| `CORS_ORIGIN` | deploy | Frontend origin allowed by the API CORS policy. For local `cdk synth`, the app loads the repo root `.env` and falls back to `http://localhost:3000` if unset. |
| `MAIL_FROM` | deploy | Verified SES sender address or domain identity used for invitations, OTP, magic links, and password resets. |
| `COGNITO_DOMAIN_PREFIX` | deploy | Globally unique Cognito Hosted UI domain prefix. |
| `OAUTH_CALLBACK_URLS` | deploy | Optional comma-separated callback URLs. Defaults to `${CORS_ORIGIN}/api/bff/auth/oauth/callback`. |
| `OAUTH_LOGOUT_URLS` | deploy | Optional comma-separated logout URLs. Defaults to `${CORS_ORIGIN}/login`. |
| `CDK_REQUIRE_APP_ENV` | deploy | Set to `true` for deploy validation so missing app env vars fail fast instead of using synth placeholders. |
| `CDK_DEFAULT_ACCOUNT` | deploy | AWS account ID (auto-populated when using `aws configure`). |
| `CDK_DEFAULT_REGION` | deploy | AWS region (defaults to `us-east-1`). |

### Validate (no AWS credentials required)

```bash
npm run infra:synth
```

`synth` loads the repo root `.env` automatically. If `CORS_ORIGIN` is blank locally, synth uses `http://localhost:3000` so you do not need to export anything just to validate the templates.

### Bootstrap (once per account/region)

```bash
npx cdk bootstrap aws://<account-id>/<region>
```

To create the GitHub Actions OIDC deploy role, run:

```bash
./infrastructure/scripts/setup-oidc.sh
```

### Deploy

```bash
# Stateful resources — VPC, ECR, KMS, Cognito, SNS/SQS
npx cdk deploy NotesInfraStack \
  --require-approval never \
  --context corsOrigin=https://app.example.com \
  --context mailFrom=no-reply@app.example.com \
  --context cognitoDomainPrefix=notes-example-prod

# Services — ECS Fargate tasks, ALB, CloudWatch (CI/CD normally handles this)
npx cdk deploy NotesServicesStack \
  --require-approval never \
  --context imageTag=<git-sha> \
  --context corsOrigin=https://app.example.com \
  --context mailFrom=no-reply@app.example.com \
  --context cognitoDomainPrefix=notes-example-prod
```

### Destroy

```bash
npx cdk destroy --all --context removalPolicy=destroy
```

The `removalPolicy=destroy` context flag must be set to allow ECR, KMS, and Cognito to be deleted with the stack.

### CI/CD

Two GitHub Actions workflows are included:

- **`ci.yml`** — runs on every push and PR: CDK synth, TypeScript build, lint, Mongo-backed API e2e tests, Docker build check
- **`deploy.yml`** — deploys infrastructure, builds and pushes Docker images to ECR, then deploys the ECS services via OIDC (no long-lived AWS credentials stored in GitHub)

Required GitHub secrets and variables:

| Name | Type | Description |
|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | Secret | IAM role ARN assumed via OIDC |
| `AWS_ACCOUNT_ID` | Variable | AWS account ID |
| `AWS_REGION` | Variable | Deploy region |
| `CORS_ORIGIN` | Variable | Frontend origin for CORS |
| `MAIL_FROM` | Variable | Verified SES sender for production email |
| `COGNITO_DOMAIN_PREFIX` | Variable | Unique Cognito Hosted UI domain prefix |
| `OAUTH_CALLBACK_URLS` | Variable | Optional comma-separated Cognito callback URLs |
| `OAUTH_LOGOUT_URLS` | Variable | Optional comma-separated Cognito logout URLs |
