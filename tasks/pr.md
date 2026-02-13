# PR: Reorganize docker infra and add `clawforge` CLI

## Summary

- Reorganize docker infrastructure into purpose-specific directories
- Split OpenClaw bot infra from the org server (api/web/postgres) compose setup
- Add `packages/server` with a `clawforge` CLI command for running clawbots locally

## Changes

### Docker reorganization

- `infra/compose/` + `infra/docker/` → split into two concerns:
  - **`infra/clawforge-server/`** — org server docker-compose + Dockerfiles (api, web)
  - **`infra/bot/common/`** — OpenClaw bot Dockerfile, bot docker-compose, helper scripts
- Removed OpenClaw services from the org server compose file (they now live in `infra/bot/common/docker-compose.yml`)
- Updated Dockerfile paths in compose to match new locations
- Moved `extract-home.sh` to `infra/bot/common/scripts/`

### `packages/server` — clawforge CLI

- New `@clawforge/server` package with Commander.js-based CLI
- `clawforge help` — prints usage info, describes purpose and dependencies
- `clawforge --version` — prints `0.0.1`
- `src/lib/paths.ts` — path utilities for resolving compose files at `infra/clawforge-server/`
- Private package, auto-discovered by pnpm workspace

### Docs

- Updated `README.md` — new repo structure, fixed compose paths, removed OpenClaw from service table
- Updated `ARCHITECTURE.md` — added `packages/server` and `infra/bot/common` sections, updated infra paths

## Test plan

- [ ] `pnpm install` succeeds
- [ ] `pnpm --filter @clawforge/server build` compiles without errors
- [ ] `node packages/server/dist/cli.js help` prints help text
- [ ] `node packages/server/dist/cli.js --version` prints `0.0.1`
- [ ] `docker compose -f infra/clawforge-server/docker-compose.yml config` validates compose file
- [ ] `docker compose -f infra/bot/common/docker-compose.yml config` validates bot compose file
