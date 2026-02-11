FROM node:22-alpine AS base
RUN npm install -g pnpm@10

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/web/package.json packages/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages/web packages/web
COPY packages/shared packages/shared
COPY packages/api packages/api
COPY docs docs
ENV NEXT_PUBLIC_API_URL=http://localhost:4000
RUN pnpm --filter @clawforge/web build:next

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy the standalone server and app files
COPY --from=build /app/packages/web/.next/standalone/packages/web ./packages/web
COPY --from=build /app/packages/web/.next/standalone/package.json ./package.json
COPY --from=build /app/packages/web/.next/static ./packages/web/.next/static
# Install production deps with hoisted layout for clean node_modules
RUN npm install -g pnpm@10
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc ./
COPY --from=build /app/packages/web/package.json ./packages/web/package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
RUN echo "node-linker=hoisted" >> .npmrc && pnpm install --frozen-lockfile --prod

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "packages/web/server.js"]
