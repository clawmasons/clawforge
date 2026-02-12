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
│       │          │ Drizzle  │                               │
│       │          │BetterAuth│    ┌──────────┐              │
│       │          └──────────┘    │ OpenClaw │              │
│       │               ▲          │  :8080   │              │
│       └───────────────┘          └──────────┘              │
│        (auth cookies,            (Google OAuth              │
│         tRPC w/ creds)            via API)                  │
└─────────────────────────────────────────────────────────────┘
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

### `infra/docker/openclaw` — OpenClaw (placeholder)

Minimal Node.js HTTP server that will be replaced with the real OpenClaw service.



### Workflow

1. Modify the schema in `packages/api/src/db/schema.ts`
2. Generate migration files: `pnpm --filter @clawforge/api db:generate`
3. Commit the generated files in `packages/api/drizzle/` to git
4. Build: `pnpm build:deploy` — esbuild bundles the Lambda, then copies `drizzle/` into `dist-lambda/`
5. Deploy: `terraform apply` — creates/updates the migration Lambda and invokes it

### How it works

The migration Lambda (`migrateHandler` in `packages/api/src/lambda.ts`) uses a custom runner instead of Drizzle's built-in `migrate()`. This is because:

- Drizzle's migrator always runs `CREATE SCHEMA IF NOT EXISTS`, which requires `CREATE` privilege on the database — the RDS Proxy IAM-auth user doesn't have this
- The custom runner creates a `__drizzle_migrations` tracking table in the `public` schema using `CREATE TABLE IF NOT EXISTS`
- It reads Drizzle's journal (`drizzle/meta/_journal.json`), checks which migrations are already applied, and runs only pending ones
- Each migration's SQL is split on `--> statement-breakpoint` markers and executed statement-by-statement

### Key files

| File | Purpose |
|------|---------|
| `packages/api/src/db/schema.ts` | Drizzle schema (source of truth) |
| `packages/api/drizzle/` | Generated migration SQL + journal (committed) |
| `packages/api/src/lambda.ts` | `migrateHandler` — custom migration runner |
| `packages/api/esbuild.lambda.mjs` | Copies `drizzle/` into Lambda bundle |
| `infra/terraform/modules/api/main.tf` | Migration Lambda + `aws_lambda_invocation` |

## Local Development Infrastructure

Dockerfiles live in `infra/docker/` (one per service). Docker Compose config is at `infra/compose/docker-compose.yml`.

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

## Type Safety Flow

1. API defines procedures with Zod input schemas
2. API exports `AppRouter` type
3. Shared re-exports `AppRouter`
4. Web imports `AppRouter` to create a fully typed tRPC client
