# Encrypted Notes Frontend

Next.js App Router frontend for the notes portfolio project.

## Architecture

- App Router pages and route handlers.
- BFF route handlers under `/api/bff/*`.
- API access and refresh tokens stored in HttpOnly cookies.
- TanStack Query for server state.
- Workspace subdomain resolution through `GET /api/bff/workspaces/resolve/:subdomain`.
- Workspace switching through tenant URLs.
- Realtime note invalidation through the fanout service.
- Client-side envelope encryption for note title and content.
- Admin screens for members, roles, invitations, deleted notes, and note history.

## Getting Started

Copy the local frontend env file:

```bash
cp .env.example .env.local
```

Run the backend stack from the repo root, then start the frontend:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Local Subdomains

The app can build tenant URLs like `acme.localhost:3000`. For production-style shared login across tenant subdomains, use a real root domain and set:

```bash
NEXT_PUBLIC_ROOT_DOMAIN=notes.example.com
AUTH_COOKIE_DOMAIN=.notes.example.com
AUTH_COOKIE_SECURE=true
```

For local shared-cookie testing, a wildcard loopback domain such as `lvh.me` is usually easier:

```bash
NEXT_PUBLIC_ROOT_DOMAIN=lvh.me
AUTH_COOKIE_DOMAIN=.lvh.me
```

Then open `http://lvh.me:3000` and tenant workspaces such as `http://acme.lvh.me:3000`.

## Realtime

The frontend connects to the fanout service with Socket.IO and uses the same HttpOnly `notes_access_token` cookie as the BFF. No access token is stored in localStorage.

For local dev:

```bash
NEXT_PUBLIC_WS_URL=http://localhost:8080
```

The fanout service must allow the frontend origin:

```bash
FANOUT_CORS_ORIGIN=http://localhost:3000
```

## Encryption

Note titles and content are encrypted in the browser before they are sent to the API. The API stores only ciphertext, IVs, and the KMS-encrypted data key.

LocalStack creates `alias/notes-local` during startup. The frontend uses:

```bash
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_KMS_ENDPOINT=http://localhost:4566
NEXT_PUBLIC_KMS_KEY_ID=alias/notes-local
NEXT_PUBLIC_AWS_ACCESS_KEY_ID=test
NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=test
```

The public static credentials are only for LocalStack. In production, replace them with short-lived browser credentials scoped to the current workspace's KMS key.

## BFF Endpoints

```http
POST /api/bff/auth/login
POST /api/bff/auth/register
POST /api/bff/auth/logout
GET  /api/bff/auth/me

GET  /api/bff/workspaces
POST /api/bff/workspaces
GET  /api/bff/workspaces/resolve/:subdomain
GET  /api/bff/workspaces/:workspaceId/members
PATCH /api/bff/workspaces/:workspaceId/members/:userId/roles
GET  /api/bff/workspaces/:workspaceId/roles
POST /api/bff/workspaces/:workspaceId/roles
POST /api/bff/workspaces/:workspaceId/invitations

GET    /api/bff/workspaces/:workspaceId/notes
POST   /api/bff/workspaces/:workspaceId/notes
GET    /api/bff/workspaces/:workspaceId/notes/deleted
GET    /api/bff/workspaces/:workspaceId/notes/:noteId/versions
PATCH  /api/bff/workspaces/:workspaceId/notes/:noteId
DELETE /api/bff/workspaces/:workspaceId/notes/:noteId
```
