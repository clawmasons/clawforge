FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY packages/web/.next/standalone ./
COPY packages/web/.next/static ./packages/web/.next/static
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "packages/web/server.js"]
