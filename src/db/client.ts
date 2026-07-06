import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

// Mirrors mac-auth: postgres-js driver + drizzle-orm/postgres-js.
export const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });

export type DB = typeof db;
// The object handed to a `db.transaction(async (tx) => …)` callback. Services that
// must run inside a caller's transaction accept `DB | Tx`.
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DBorTx = DB | Tx;
