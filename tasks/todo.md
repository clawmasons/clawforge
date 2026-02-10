# Clawforge Monorepo Initialization

## Completed
- [x] Root scaffolding (package.json, pnpm-workspace.yaml, tsconfig.base.json, .gitignore, .npmrc)
- [x] Shared types package (packages/shared)
- [x] API server (packages/api) — Fastify + tRPC + Drizzle
- [x] Web client (packages/web) — Next.js + tRPC + TanStack Query + Tailwind v4
- [x] OpenClaw placeholder (infra/docker/openclaw)
- [x] Dockerfiles for api, web, openclaw
- [x] docker-compose.yml with postgres, api, web, openclaw
- [x] Pulumi stub (infra/aws)
- [x] CLAUDE.md updated with project details

## AWS Deployment (Web + API via OpenNext + Terraform)
- [x] Extract `app.ts` from `server.ts` (Fastify app factory)
- [x] Create `lambda.ts` handler with `@fastify/aws-lambda`
- [x] Create `esbuild.lambda.mjs` bundler config
- [x] Add `build:lambda` script + `@fastify/aws-lambda`, `esbuild`, `@types/aws-lambda` deps
- [x] Create `packages/web/open-next.config.ts` + `@opennextjs/aws` devDep
- [x] Add `build:open-next` script to web package
- [x] Add `build:deploy` orchestration script to root
- [x] Update `.gitignore` (terraform state, dist-lambda, .open-next)
- [x] Terraform bootstrap module (S3 state + DynamoDB locks)
- [x] Terraform networking module (VPC, subnets, NAT, security groups)
- [x] Terraform DNS module (Route53, ACM certs us-east-1 + us-west-2)
- [x] Terraform database module (RDS PostgreSQL, RDS Proxy, Secrets Manager)
- [x] Terraform API module (Lambda, API Gateway HTTP API, custom domain)
- [x] Terraform web module (OpenNext wrapper, CloudFront, S3, Route53)
- [x] Terraform dev environment (composes all modules, S3 backend)
- [x] Lambda build verified: `pnpm --filter @clawforge/api build:lambda` succeeds (835KB bundle)

### Deployment Steps (remaining)
- [ ] `terraform init && terraform apply` bootstrap
- [ ] `terraform init && terraform apply` networking + dns
- [ ] Update domain registrar NS records (manual)
- [ ] `terraform apply` database
- [ ] `pnpm build:deploy` (build API bundle + OpenNext output)
- [ ] `terraform apply` api + web
- [ ] Verify: `curl https://api.clawforge.org/health` + visit `https://clawforge.org`

## Better Auth Implementation
- [x] Install better-auth + drizzle-kit in API
- [x] Create `packages/api/src/auth.ts` — Better Auth config with Google OAuth, org plugin, domain restriction, auto org creation
- [x] Create `packages/api/drizzle.config.ts` — Drizzle Kit config
- [x] Update `packages/api/src/db/schema.ts` — Better Auth tables (user, session, account, verification, organization, member, invitation) + launchedProgramId field
- [x] Update `packages/api/src/trpc.ts` — createContext with session, protectedProcedure middleware
- [x] Update `packages/api/src/app.ts` — Mount auth catch-all route, CORS with credentials, pass createContext to tRPC
- [x] Update `packages/api/src/router.ts` — Add `me` query, `programs.launch` mutation, update org table reference
- [x] Add db:generate, db:migrate, db:push scripts to API package.json
- [x] Install better-auth in web package
- [x] Create `packages/web/src/lib/auth-client.ts` — Better Auth React client with org plugin
- [x] Update `packages/web/src/lib/trpc-provider.tsx` — credentials: "include" on fetch
- [x] Update `packages/web/src/components/header.tsx` — Auth-aware UI (sign in/out, avatar)
- [x] Update `packages/web/src/components/program-card.tsx` — Launch flow with localStorage + auth redirect
- [x] Create `packages/web/src/app/programs/launch/page.tsx` — Launch confirmation page
- [x] Create `packages/web/src/app/auth/error/page.tsx` — Auth error page (domain rejection)
- [x] Update `infra/compose/docker-compose.yml` — Auth env vars for API service
- [x] Update `infra/terraform/modules/api/main.tf` — Auth env vars in Lambda, CORS credentials
- [x] Update `infra/terraform/modules/api/variables.tf` — Auth variable declarations
- [x] Update `infra/terraform/environments/dev/main.tf` — Pass auth vars to API module
- [x] Update `infra/terraform/environments/dev/variables.tf` — Auth variable declarations
- [x] All builds pass: `pnpm build` (tsc + next build), `pnpm build:lambda` (esbuild)

### Remaining Steps
- [ ] Set up Google Cloud Console OAuth credentials
- [ ] Create `.env` with `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] Start Postgres + run `pnpm db:push` to sync schema
- [ ] End-to-end test: sign up, domain restriction, launch flow
- [ ] Set `terraform.tfvars` with auth secrets for production deploy

## Verification Results
- [x] `pnpm install` — passes
- [x] `pnpm --filter @clawforge/api build` — compiles cleanly
- [x] `pnpm --filter @clawforge/web build` — compiles cleanly, standalone output generated
- [x] API dev server starts, `/health` returns `{"status":"ok","service":"api"}`
- [x] tRPC `hello` procedure returns `{"greeting":"Hello, world!"}`
- [x] Docker compose — all 4 services start and are healthy
- [x] `curl http://localhost:4000/health` returns OK
- [x] `curl http://localhost:8080/health` returns OK
- [x] `curl http://localhost:3000` returns HTTP 200 with Clawforge page
