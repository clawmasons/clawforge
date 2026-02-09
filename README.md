# Clawforge

Full-stack TypeScript monorepo — Next.js frontend, Fastify/tRPC API, PostgreSQL, Docker Compose dev environment.

See [ARCHITECTURE.md](ARCHITECTURE.md) for a high-level overview of the components.

## Prerequisites

- Node.js >= 22
- pnpm (`npm install -g pnpm`)
- Docker (for the full stack)

## Getting Started

```bash
# Install dependencies
pnpm install

# Run all packages in dev mode
pnpm dev

# Or run individual packages
pnpm --filter @clawforge/api dev    # API on :4000
pnpm --filter @clawforge/web dev    # Web on :3000
```

## Docker Compose

Brings up all services: PostgreSQL, API, Web, and OpenClaw.

```bash
docker compose -f infra/compose/docker-compose.yml up --build
```

| Service    | Port |
|-----------|------|
| Web       | 3000 |
| API       | 4000 |
| PostgreSQL| 5432 |
| OpenClaw  | 8080 |

## Build

```bash
pnpm build

# Clean build artifacts and rebuild from scratch
pnpm clean:build

# Clean only (removes dist/, .next/, out/)
pnpm clean
```

## Repository Structure

```
clawforge/
├── packages/
│   ├── api/             # Fastify + tRPC + Drizzle
│   ├── web/             # Next.js 15 App Router
│   └── shared/          # Shared TypeScript types
├── infra/
│   ├── docker/          # Dockerfiles
│   ├── compose/         # docker-compose.yml
│   └── aws/             # Pulumi IaC stub
└── tasks/               # Task tracking
```

## Environment Variables

| Variable | Used By | Default | Description |
|----------|---------|---------|-------------|
| `DATABASE_URL` | api | `postgresql://postgres:postgres@localhost:5432/clawforge` | PostgreSQL connection string |
| `PORT` | api, openclaw | `4000` / `8080` | Server listen port |
| `HOST` | api | `0.0.0.0` | Server bind address |
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:4000` | API base URL (client-side) |
