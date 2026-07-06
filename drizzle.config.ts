import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config. Used at build/dev time to generate SQL migrations from
 * src/db/schema.ts into ./drizzle. At runtime the container applies those SQL files
 * with drizzle-orm's migrator (see src/db/migrate.ts) — drizzle-kit is not needed then.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://crm:changeme@localhost:5432/crm",
  },
});
