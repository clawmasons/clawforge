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
