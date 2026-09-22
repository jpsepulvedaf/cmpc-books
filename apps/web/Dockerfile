# ── CMPC Libros Web — multi-stage ──────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /usr/src/app
# npm 10.8.2 (shipped with node:20-alpine) crashes with "edgesOut" on this
# monorepo layout; npm 11 fixes the bug while staying on Node 20.
RUN npm install -g npm@11 --no-audit --no-fund
COPY package.json ./
RUN npm install
EXPOSE 5173

FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80