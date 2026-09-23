import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Load the workspace/repo `.env` so `prisma migrate`/`seed` respect a
// user-defined DATABASE_URL (e.g. a custom host port). Real environment
// variables (e.g. the Docker compose DATABASE_URL) always win over the file.
const cwd = process.cwd();
for (const candidate of [resolve(cwd, ".env"), resolve(cwd, "../../.env")]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate });
  }
}

// Prisma 7 requires prisma.config.ts (the `prisma` key in package.json is no
// longer supported). The datasource URL is resolved in this order:
//   1. DATABASE_URL from the real environment (compose injects it in Docker)
//   2. DATABASE_URL from `.env` (loadEnv above)
//   3. Fallback to the Dockerized PostgreSQL (compose service `db`, published
//      on host port 5433) so tools work even with no env file at all.
// The Homebrew local instance is never targeted: compose is the single
// supported local path.
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