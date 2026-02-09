# Architecture

Clawforge is a full-stack TypeScript monorepo. The frontend communicates with the backend via tRPC, giving end-to-end type safety with zero code generation.

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                          │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │   Web    │───▶│   API    │───▶│ Postgres │              │
│  │  :3000   │    │  :4000   │    │  :5432   │              │
│  │ Next.js  │    │ Fastify  │    │          │              │
│  └──────────┘    │  tRPC    │    └──────────┘              │
│                  │ Drizzle  │                               │
│                  └──────────┘    ┌──────────┐              │
│                                  │ OpenClaw │              │
│                                  │  :8080   │              │
│                                  └──────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Packages

### `packages/api` — Backend

Fastify server with tRPC v11 endpoints and Drizzle ORM for PostgreSQL access. Exposes `/health` for health checks and `/trpc/*` for typed RPC procedures. Input validation via Zod.

### `packages/shared` — Type Bridge

Re-exports the `AppRouter` type from the API so the frontend gets full type safety without a runtime dependency on the API package.

```
web ──(depends on)──▶ shared ──(type re-export)──▶ api
```

### `packages/web` — Frontend

Next.js 15 App Router with React 19, tRPC React Query for data fetching, and Tailwind CSS v4 for styling.

### `infra/docker/openclaw` — OpenClaw (placeholder)

Minimal Node.js HTTP server that will be replaced with the real OpenClaw service.

## Infrastructure

Dockerfiles live in `infra/docker/` (one per service). Docker Compose config is at `infra/compose/docker-compose.yml`. A Pulumi stub for AWS deployment lives at `infra/aws/`.

## Type Safety Flow

1. API defines procedures with Zod input schemas
2. API exports `AppRouter` type
3. Shared re-exports `AppRouter`
4. Web imports `AppRouter` to create a fully typed tRPC client
