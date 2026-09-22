import { defineConfig } from "prisma/config";

// Prisma 7 requires prisma.config.ts (the `prisma` key in package.json is no
// longer supported). The datasource URL falls back to the local Homebrew
// PostgreSQL so that generate/migrate/seed work even without the env var set.
const url =
  process.env.DATABASE_URL ??
  "postgresql://cmpc:cmpc@localhost:5432/cmpc_books?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});