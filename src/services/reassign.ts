import { eq } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { companies, reassignments, touchpoints } from "../db/schema.js";

// Ownership handover (§7). Reassigns ALL of `from`'s owned companies and touchpoints
// to `to` — the incoming person inherits the whole book. `created_by` is left untouched
// (permanent record of who first added each thing). Logged for institutional continuity.
export async function reassign(
  db: DB,
  { from, to, by }: { from: string; to: string; by: string },
): Promise<{ companiesMoved: number; touchpointsMoved: number }> {
  return db.transaction(async (tx) => {
    const c = await tx
      .update(companies)
      .set({ owner: to, updatedAt: new Date() })
      .where(eq(companies.owner, from))
      .returning({ id: companies.id });
    const t = await tx
      .update(touchpoints)
      .set({ owner: to })
      .where(eq(touchpoints.owner, from))
      .returning({ id: touchpoints.id });
    await tx.insert(reassignments).values({
      fromMacUserId: from,
      toMacUserId: to,
      companiesMoved: c.length,
      touchpointsMoved: t.length,
      by,
    });
    return { companiesMoved: c.length, touchpointsMoved: t.length };
  });
}
