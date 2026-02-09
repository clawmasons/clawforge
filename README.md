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
│   └── terraform/       # AWS infrastructure (Terraform)
│       ├── bootstrap/   # State bucket + lock table
│       ├── modules/     # networking, dns, database, api, web
│       └── environments/dev/
└── tasks/               # Task tracking
```

## AWS Deployment (Terraform)

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- AWS CLI configured with credentials
- Domain `clawforge.org` registered

### 1. Bootstrap (one-time)

Creates the S3 bucket for Terraform state and DynamoDB table for locking.

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
```

### 2. Deploy infrastructure

```bash
cd infra/terraform/environments/dev
terraform init
```

Apply in stages — networking and DNS first, since the domain registrar NS records need updating before certificates can validate:

```bash
# Networking + DNS (creates Route53 zone)
terraform apply -target=module.networking -target=module.dns
```

Update your domain registrar with the NS records from the output, then wait for DNS propagation before continuing.

```bash
# Database
terraform apply -target=module.database

# Build application artifacts
cd ../../../..
pnpm build:deploy    # builds Next.js, OpenNext output, and API Lambda bundle

# Deploy API + Web
cd infra/terraform/environments/dev
terraform apply
```

### 3. Verify

```bash
curl https://api.clawforge.org/health
# {"status":"ok","service":"api"}

open https://clawforge.org
```

### Cost estimate (dev)

| Resource | Monthly |
|----------|---------|
| NAT Gateway | ~$32 |
| RDS t4g.micro | ~$12 |
| Lambda (low traffic) | ~$0 |
| CloudFront + S3 | ~$2 |
| Route53 | $0.50 |
| **Total** | **~$47** |

## Environment Variables

| Variable | Used By | Default | Description |
|----------|---------|---------|-------------|
| `DATABASE_URL` | api | `postgresql://postgres:postgres@localhost:5432/clawforge` | PostgreSQL connection string |
| `PORT` | api, openclaw | `4000` / `8080` | Server listen port |
| `HOST` | api | `0.0.0.0` | Server bind address |
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:4000` | API base URL (client-side) |
