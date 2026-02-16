# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

- **Monorepo**: pnpm workspaces
- **API**: Fastify + tRPC v11 + Drizzle ORM + PostgreSQL (`packages/api`, port 4000)
- **Web**: Next.js 15 App Router + tRPC React Query + Tailwind CSS v4 (`packages/web`, port 3000)
- **Shared**: TypeScript types shared between packages (`packages/shared`)
- **Server**: `clawforge` CLI for running clawbots locally (`packages/server`)
- **Docker**: Compose-based dev environment (`infra/clawforge-server/docker-compose.yml`)

## Commands

```bash
# Install dependencies
pnpm install

# Dev (all packages)
pnpm dev

# Dev (single package)
pnpm --filter @clawforge/api dev
pnpm --filter @clawforge/web dev

# Build
pnpm build

# Docker dev environment
docker compose -f infra/clawforge-server/docker-compose.yml up --build
```

## Repository

- **Remote:** git@github.com:clawmasons/clawforge.git
- **Main branch:** main


## Workflow Orchestration


## Specs Repository Integration

This repo is part of the ClawForge multi-repo project. The canonical specs repo at `../specs/` is the source of truth for feature specifications, API contracts, and data models.

### Before Implementing Any Feature

1. Check `../specs/specs/` for a relevant feature spec. Do not begin work without one for cross-repo features.
2. Read `../specs/constitution.md` for project-wide principles (multi-tenant isolation, security posture, open source first).
3. Read `../specs/shared-config.md` for cross-repo conventions (naming, error handling, auth patterns).
4. Check `../specs/contracts/` before creating or modifying any API endpoints, WebSocket messages, or event schemas. If a contract exists, implement to the contract. If no contract exists for a cross-repo API, one must be created in the specs repo first.
5. Check `../specs/data-models/` for canonical entity definitions before modifying database schemas.

### After Implementation

- Note which spec was implemented in the PR description (link to spec file or quote the spec name).
- Document any deviations from the spec in the PR description, with rationale.
- If deviations are significant, file an amendment to the spec in the specs repo.

### Key Principles (from constitution.md)

- **Multi-tenant isolation is non-negotiable**: Every data path must enforce tenant boundaries.
- **Security first**: This is an access management product. Threat modeling is required for auth/authz/tenant features.
- **Open source first**: Core functionality must work standalone without ClawForge Cloud.
- **Contract-driven**: Cross-repo APIs are defined in specs repo contracts before implementation.

