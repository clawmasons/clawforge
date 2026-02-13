# ── Stage 1: Install dependencies ──────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────────
FROM deps AS builder

COPY tsconfig.base.json ./
COPY packages/api/ ./packages/api/
COPY packages/shared/ ./packages/shared/

RUN pnpm --filter @clawforge/api build

# ── Stage 3: Production runtime ────────────────────────────────────
FROM node:22-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/api/dist ./packages/api/dist

WORKDIR /app/packages/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
