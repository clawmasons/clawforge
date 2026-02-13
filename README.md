# Clawforge

Full-stack TypeScript monorepo — Next.js frontend, Fastify/tRPC API, PostgreSQL, Docker Compose dev environment.

See [ARCHITECTURE.md](ARCHITECTURE.md) for a high-level overview of the components.

## Prerequisites

- Node.js >= 22
- pnpm (`npm install -g pnpm`)
- Docker 

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Google OAuth credentials (see below)

# Push database schema (requires Postgres running)
docker compose -f infra/clawforge-server/docker-compose.yml up -d postgres
pnpm --filter @clawforge/api db:push

# Run all packages in dev mode
pnpm dev

# Or run individual packages
pnpm --filter @clawforge/api dev    # API on :4000
pnpm --filter @clawforge/web dev    # Web on :3000
```

## Docker Compose

Brings up all services: PostgreSQL, API, and Web. Auth env vars are read from the root `.env` file.

```bash
docker compose -f infra/clawforge-server/docker-compose.yml up --build
```

| Service    | Port |
|-----------|------|
| Web       | 3000 |
| API       | 4000 |
| PostgreSQL| 5432 |

## Build

```bash
pnpm build

# Clean build artifacts and rebuild from scratch
pnpm clean:build

# Clean only (removes dist/, .next/, .open-next/, out/)
pnpm clean

# build nextjs (used to push to prod)
pnpm build:deploy
```

## Packaging

The `clawforge` CLI can be bundled and packed as a standalone npm tarball. Only the CLI is included — the API and Web packages are deployed separately via Docker.

```bash
# 1. Bundle — runs scripts/bundle.mjs, compiles TypeScript, creates bundle/
pnpm bundle

# 2. Pack — bundles + creates a .tgz tarball
pnpm pack

# 3. Install globally from the tarball
npm install -g ./clawforge-0.0.1.tgz
```

**What's included:** the compiled CLI (`bundle/packages/cli/`), runtime dependencies (commander, nanoid, yaml), bot infrastructure files (`infra/bot/`), and hoisted `node_modules/`.

**What's excluded:** API, Web, shared packages, dev dependencies, and workspace config — those are cleaned up during bundling.

## Documentation

Documentation is built with [Fumadocs](https://fumadocs.vercel.app) and served at `/docs`. Content lives in the `docs/` folder at the monorepo root as MDX files.

Visit [localhost:3000/docs](http://localhost:3000/docs) when running the dev server.

## Repository Structure

```
clawforge/
├── docs/                # Documentation (MDX, served at /docs)
├── packages/
│   ├── api/             # Fastify + tRPC + Drizzle + Better Auth
│   ├── server/          # clawforge CLI (Commander.js)
│   ├── web/             # Next.js 15 App Router + Better Auth client
│   └── shared/          # Shared TypeScript types
├── infra/
│   ├── bot/common/      # Bot docker & scripts (OpenClaw, extract-home)
│   └── clawforge-server/# Org server docker-compose & Dockerfiles
└── tasks/               # Task tracking
```

### 3. Verify

```bash
curl https://api.clawforge.org/health
# {"status":"ok","service":"api"}

open https://clawforge.org
```

## Authentication

Clawforge uses [Better Auth](https://better-auth.com) with Google OAuth. Only corporate email domains are allowed — consumer providers (Gmail, Yahoo, Outlook, etc.) are blocked at signup. Organizations are auto-created from the user's email domain.

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://localhost:4000/api/auth/callback/google`
4. Add authorized JavaScript origin: `http://localhost:3000`
5. Copy the Client ID and Secret to your `.env` file

### Database Migrations

**Local development** uses `db:push` which syncs the schema directly without migration files:

```bash
pnpm --filter @clawforge/api db:push
```

**Production** uses versioned migration files applied automatically during deployment:

```bash
# 1. Generate migration files after schema changes
pnpm --filter @clawforge/api db:generate

# 2. Commit the generated files in packages/api/drizzle/

# 3. Build and deploy — migrations run automatically via Terraform
pnpm build:deploy
cd infra/terraform/environments/dev && ./tf.sh apply
```

Migrations are applied by a dedicated Lambda function (`migrateHandler` in `packages/api/src/lambda.ts`) that is automatically invoked by Terraform on every deploy. The migration Lambda:

- Shares the same bundle as the API Lambda (same zip, different handler)
- Uses a custom runner (not Drizzle's built-in `migrate()`) to avoid `CREATE SCHEMA` privilege requirements
- Tracks applied migrations in a `__drizzle_migrations` table in the `public` schema
- Is idempotent — safe to re-run on unchanged schemas
- Re-triggers only when the Lambda source code hash changes

## Environment Variables

| Variable | Used By | Default | Description |
|----------|---------|---------|-------------|
| `DATABASE_URL` | api | `postgresql://postgres:postgres@localhost:5432/clawforge` | PostgreSQL connection string |
| `PORT` | api, openclaw | `4000` / `8080` | Server listen port |
| `HOST` | api | `0.0.0.0` | Server bind address |
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:4000` | API base URL (client-side) |
| `BETTER_AUTH_SECRET` | api | — | Secret key for session signing (32+ chars) |
| `BETTER_AUTH_URL` | api | — | API base URL for auth callbacks |
| `GOOGLE_CLIENT_ID` | api | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | api | — | Google OAuth client secret |
| `WEB_URL` | api | `http://localhost:3000` | Web frontend URL (for CORS and redirects) |
