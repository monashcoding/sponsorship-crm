import { sql } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { crmMember } from "../db/schema.js";
import type { MacClaims } from "../verify.js";

/** Keep the crm_member identity cache fresh from the token on every request. */
export async function upsertMember(db: DB, claims: MacClaims): Promise<void> {
  await db
    .insert(crmMember)
    .values({
      macUserId: claims.macUserId,
      email: claims.email,
      name: claims.name ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: crmMember.macUserId,
      set: {
        email: claims.email,
        name: claims.name ?? null,
        lastSeenAt: new Date(),
      },
    });
}

export async function listMembers(db: DB) {
  return db
    .select()
    .from(crmMember)
    .orderBy(sql`coalesce(${crmMember.name}, ${crmMember.email})`);
}
