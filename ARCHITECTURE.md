# Architecture

Clawforge is a full-stack TypeScript monorepo. The frontend communicates with the backend via tRPC, giving end-to-end type safety with zero code generation.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Docker Compose                              │
│                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                        │
│  │   Web    │───▶│   API    │───▶│ Postgres │                        │
│  │  :3000   │    │  :4000   │    │  :5432   │                        │
│  │ Next.js  │    │ Fastify  │    │          │                        │
│  └──────────┘    │  tRPC    │    └──────────┘                        │
│       │          │ Drizzle  │                                        │
│       │          │BetterAuth│                                        │
│       │          └──────────┘                                        │
│       │               ▲                                              │
│       └───────────────┘                                              │
│        (auth cookies,                                                │
│         tRPC w/ creds)                                               │
│                                                                      │
│  ┌──────────────────┐    ┌─────────────┐    ┌────────────────────┐   │
│  │ OpenClaw Gateway │◄──▶│ Yjs Server  │◄──▶│  SPA / Browser     │   │
│  │  :18789          │    │  :1234      │    │  (Yjs peer)        │   │
│  │  (yjs-plugin)    │    │  (Y.Doc)    │    │                    │   │
│  └──────────────────┘    └─────────────┘    └────────────────────┘   │
│   Bot observes prompts    Shared document     User sends prompts     │
│   and writes responses    sync + persistence  and observes replies   │
└──────────────────────────────────────────────────────────────────────┘
```

## Packages

### `packages/api` — Backend

Fastify server with tRPC v11 endpoints and Drizzle ORM for PostgreSQL access. Exposes `/health` for health checks, `/trpc/*` for typed RPC procedures, and `/api/auth/*` for Better Auth routes. Input validation via Zod.

**Authentication**: Better Auth with Google OAuth, mounted as a Fastify catch-all route. Provides session management via cookies, a protected tRPC procedure middleware, and an organization plugin that auto-creates orgs from email domains. Consumer email domains (Gmail, Yahoo, etc.) are blocked at signup.

### `packages/shared` — Type Bridge

Re-exports the `AppRouter` type from the API so the frontend gets full type safety without a runtime dependency on the API package.

```
web ──(depends on)──▶ shared ──(type re-export)──▶ api
```

### `packages/web` — Frontend

Next.js 15 App Router with React 19, tRPC React Query for data fetching, and Tailwind CSS v4 for styling. Uses Better Auth's React client for session management and Google OAuth sign-in. tRPC requests include credentials for cookie-based auth.

### `packages/server` — Clawforge CLI

Globally-installable CLI (`clawforge` command) built with Commander.js. Used for running clawforge clawbots locally. Compose files for the org server live at `infra/clawforge-server/` and are referenced at runtime via path resolution.

### `packages/yjs-server` — Real-Time Document Server

WebSocket server that hosts a shared `Y.Doc` for real-time collaboration between bots and browser clients. Handles the Yjs sync protocol, broadcasts updates to all connected peers, and persists document state to disk (debounced atomic writes). Auth is token-based via query parameter.

### `packages/yjs-plugin` — OpenClaw Channel Plugin

Bridges the shared `Y.Doc` to the OpenClaw bot runtime as a channel plugin. Observes a `prompts` Y.Array for inbound messages targeted at the bot (via the `target` field), streams responses back through `reply-to-stream` (Y.Text) and `reply-to-array` (Y.Array), and manages bot presence in a `presence` Y.Map-of-Maps (status, type, lastUpdate, timezone).

### `infra/bot/common` — Bot Infrastructure

Docker and scripts for running OpenClaw bots locally. Includes the OpenClaw Dockerfile, yjs-server Dockerfile, a bot-specific docker-compose, skills for bot-generated apps, and helper scripts (e.g. `extract-home.sh`).

## Local Development Infrastructure

Org server Dockerfiles live in `infra/clawforge-server/docker/` (api, web). Docker Compose config is at `infra/clawforge-server/docker-compose.yml`. Bot infrastructure is at `infra/bot/common/`.

## Authentication Flow

Clawforge uses [Better Auth](https://better-auth.com) with Google OAuth for authentication. Only corporate email domains are allowed — consumer providers (Gmail, Yahoo, Outlook, etc.) are blocked at signup.

```
Browser                     Web (:3000)                API (:4000)              Google
  │                            │                          │                       │
  │── Click "Sign Up" ────────▶│                          │                       │
  │                            │── signIn.social() ──────▶│                       │
  │                            │                          │── /api/auth/signin ──▶│
  │◀── Redirect to Google ─────┼──────────────────────────┼───────────────────────│
  │── Google consent ──────────┼──────────────────────────┼──────────────────────▶│
  │◀── Callback to API ────────┼──────────────────────────│◀── auth code ─────────│
  │                            │                          │── domain check ──┐    │
  │                            │                          │◀─ create user ───┘    │
  │                            │                          │── auto-create org     │
  │◀── Redirect to Web (cookie set) ─────────────────────│                       │
  │── Subsequent requests (cookie) ──────────────────────▶│                       │
```

**Key files**:
- `packages/api/src/auth.ts` — Better Auth server config (social providers, domain restriction, org auto-creation)
- `packages/web/src/lib/auth-client.ts` — Better Auth React client
- `packages/api/src/trpc.ts` — `createContext` resolves session from cookies; `protectedProcedure` middleware

**Database schema**: Better Auth manages `user`, `session`, `account`, `verification`, `organization`, `member`, and `invitation` tables (defined in `packages/api/src/db/schema.ts`). In production, schema changes are applied via [automated migrations](#database-migrations). In local dev, use `db:push` for direct schema sync.

## Real-Time Collaboration (Yjs)

Bots and browser clients communicate through a shared Yjs document hosted by the yjs-server. Both sides are Yjs peers — there is no request/response API, just a synchronized CRDT document.

**Shared Y.Doc structure:**

- **`prompts`** (`Y.Array<Y.Map>`) — prompt queue. Each entry contains `prompt` (text), `target` (bot name or `"*"`), `reply-to-stream` (Y.Text for streaming chunks), and `reply-to-array` (Y.Array for the final response).
- **`presence`** (`Y.Map<Y.Map>`) — per-entity presence. Outer key is a snake_cased entity name, inner map has `status` (`"waiting"` | `"thinking"` | `"offline"`), `type` (`"bot"` | `"user"`), `lastUpdate` (ISO 8601), and `timezone` (IANA).

**Data flow:**

```
Browser/SPA                      Yjs Server                    OpenClaw + yjs-plugin
    │                               │                                │
    │── append prompt Y.Map ──────▶ │ ── broadcast ────────────────▶ │
    │                               │                                │── bot processes prompt
    │                               │                                │── writes to reply-to-stream
    │◀── streaming chunks ─────────│ ◀── broadcast ─────────────────│
    │                               │                                │── pushes to reply-to-array
    │◀── final response ───────────│ ◀── broadcast ─────────────────│
    │                               │                                │── updates presence
    │◀── presence change ──────────│ ◀── broadcast ─────────────────│
```

**Key files:**
- `packages/yjs-server/src/server.ts` — WebSocket server, sync protocol, persistence
- `packages/yjs-plugin/src/channel.ts` — prompt observation, response writing, presence management
- `packages/yjs-plugin/src/index.ts` — plugin registration, lifecycle (start/stop)
- `infra/bot/common/skills/yjs-app/SKILL.md` — full protocol spec for SPA developers

## Type Safety Flow

1. API defines procedures with Zod input schemas
2. API exports `AppRouter` type
3. Shared re-exports `AppRouter`
4. Web imports `AppRouter` to create a fully typed tRPC client
