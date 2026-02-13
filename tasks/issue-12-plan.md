# Issue 12: Simplify packaging — bundle only CLI, restore full builds in Dockerfiles

## Problem
The bundle script packages the entire app (API, Web, shared, infra) into a massive npm package. The Dockerfiles are thin copy-only images requiring pre-built host artifacts.

## Plan

1. Update `.dockerignore` — expand exclusions for clean Docker contexts
2. Rewrite API Dockerfile — multi-stage self-contained build (deps → builder → runner)
3. Rewrite Web Dockerfile — multi-stage self-contained build with fumadocs/standalone support
4. Update `docker-compose.yml` — add build args for NEXT_PUBLIC_API_URL
5. Simplify `scripts/bundle.mjs` — CLI-only bundle (remove API/Web/infra-server)
6. Clean up `paths.ts` — remove dead `composeDir` and `getComposeFile()` exports

## Verification
- `docker compose build` succeeds from fresh clone
- `docker compose up` — API :4000/health OK, web :3000 loads
- `pnpm bundle` produces CLI-only bundle
- `pnpm dev` unchanged

## Status
- [x] Implementation
- [x] Verification
- [ ] PR (optional)
