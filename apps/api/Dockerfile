# ── CMPC Libros API — multi-stage ──────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache openssl

FROM base AS dev
RUN npm install -g nodemon tsx 2>/dev/null || true
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