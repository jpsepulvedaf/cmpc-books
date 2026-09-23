import { defineConfig } from "prisma/config";

// Prisma 7 requires prisma.config.ts (the `prisma` key in package.json is no
// longer supported). The datasource URL falls back to the Dockerized
// PostgreSQL (compose service `db`, published on host port 5433) so that
// generate/migrate/seed work even without DATABASE_URL set. It is never the
// Homebrew local instance: the compose service is the single supported path.
const url =
  process.env.DATABASE_URL ??
  "postgresql://cmpc:cmpc@localhost:5433/cmpc_books?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});