# PR for Issue #12: Simplify packaging — bundle only CLI, restore full builds in Dockerfiles

## Summary
- Rewrote API and Web Dockerfiles as multi-stage builds that install deps and build inside the container (no host pre-build needed)
- Simplified `scripts/bundle.mjs` to only package the CLI (`packages/server`) and bot infra — removed API, Web, shared, and Docker infra from the bundle
- Cleaned up dead code in `paths.ts` and expanded `.dockerignore`

## Changes
- `.dockerignore` — Added exclusions for `bundle`, `bots`, `*.tgz`, and build artifacts
- `infra/clawforge-server/docker/api/Dockerfile` — Multi-stage build (deps → builder → runner)
- `infra/clawforge-server/docker/web/Dockerfile` — Multi-stage build with fumadocs/standalone support
- `infra/clawforge-server/docker-compose.yml` — Added `NEXT_PUBLIC_API_URL` build arg for web
- `scripts/bundle.mjs` — Removed API/Web build+copy, now bundles only CLI + infra/bot
- `packages/server/src/lib/paths.ts` — Removed unused `composeDir` and `getComposeFile()`

## Test Plan
- `docker compose build` builds both images from scratch without any host-side pre-build
- `docker compose up` starts all services: API health check passes at :4000, web loads at :3000
- `pnpm bundle` produces a CLI-only bundle (no API/Web artifacts in `bundle/`)
- CLI works: `node bundle/packages/cli/cli.js --version` returns `0.0.1`

## Issue
Fixes #12
