/**
 * Boot-time migration runner (mirrors mac-auth's src/migrate.ts).
 *
 * Applies pending SQL migrations from ./drizzle using drizzle-orm's migrator, which
 * needs only the generated SQL files at runtime (not drizzle-kit). The container runs
 * this before starting the server (see Dockerfile CMD). Uses its own short-lived
 * connection (max: 1) so it closes cleanly and exits.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const migrationClient = postgres(connectionString, { max: 1 });

async function main() {
	const db = drizzle(migrationClient);
	// pg_trgm powers the fuzzy-dedupe similarity() query (§5). Must exist before any query
	// that calls similarity(); creating it here (own connection) is idempotent and keeps it
	// out of the schema-generated migrations.
	console.log("[migrate] ensuring extensions...");
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
	console.log("[migrate] applying pending migrations...");
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("[migrate] done.");
	await migrationClient.end();
}

main().catch((err) => {
	console.error("[migrate] failed:", err);
	process.exit(1);
});
