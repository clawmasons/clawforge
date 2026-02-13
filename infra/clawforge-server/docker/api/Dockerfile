FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY node_modules ./node_modules
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY package.json ./
WORKDIR /app/packages/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
