FROM node:22-alpine AS base
RUN npm install -g pnpm@10

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/api/package.json packages/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages/api packages/api
COPY packages/shared packages/shared
RUN pnpm --filter @clawforge/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY packages/api/package.json packages/api/package.json
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/packages/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
