# ── CMPC Libros API — multi-stage ──────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache openssl

# ── dev: installs project deps so `npm run start:dev` (tsx watch) works
# inside the container; the compose file bind-mounts ./apps/api and keeps an
# anonymous node_modules volume so host files never overwrite it.
# (node:20-alpine ships npm 10.8.2 which crashes with "edgesOut" on monorepo
# metadata; npm 11 fixes that bug while staying on the Node 20 major.)
FROM base AS dev
RUN npm install -g npm@11 --no-audit --no-fund
COPY package.json ./
RUN npm install
WORKDIR /usr/src/app
EXPOSE 3000

# ── production builder ─────────────────────────────────────────────
FROM base AS builder
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]