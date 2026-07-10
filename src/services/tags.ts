import { and, asc, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { companyTags, tags } from "../db/schema.js";
import { normalizeName } from "../lib/normalize.js";

// A fixed palette so chips are visually distinct without asking the user to pick a
// colour. Assigned deterministically at creation from the normalized name, so the
// same label always lands on the same colour.
const PALETTE = [
	"#4f7cff", // blue
	"#3fb27f", // green
	"#e0a33e", // amber
	"#c86bd6", // purple
	"#e06c75", // red
	"#4bb8c9", // teal
	"#d98a54", // orange
	"#8b93a3", // grey
];

function colorFor(nameNormalized: string): string {
	let h = 0;
	for (let i = 0; i < nameNormalized.length; i++) {
		h = (h * 31 + nameNormalized.charCodeAt(i)) >>> 0;
	}
	return PALETTE[h % PALETTE.length] as string;
}

export interface TagWithCount {
	id: string;
	name: string;
	color: string;
	count: number; // how many companies carry it
}

/** All tags, alphabetical, each with the number of companies using it. */
export async function listTags(db: DB): Promise<TagWithCount[]> {
	return db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			count: sql<number>`count(${companyTags.companyId})::int`.as("count"),
		})
		.from(tags)
		.leftJoin(companyTags, eq(companyTags.tagId, tags.id))
		.groupBy(tags.id)
		.orderBy(asc(tags.name));
}

/**
 * Get an existing tag by normalized name, or create it. Idempotent, so the UI can
 * "add a tag by typing its name" without worrying about duplicates.
 */
export async function getOrCreateTag(
	db: DB,
	name: string,
	createdBy: string,
): Promise<typeof tags.$inferSelect> {
	const nameNormalized = normalizeName(name);
	if (!nameNormalized) throw new Error("tag name is empty");

	const [existing] = await db
		.select()
		.from(tags)
		.where(eq(tags.nameNormalized, nameNormalized))
		.limit(1);
	if (existing) return existing;

	const [created] = await db
		.insert(tags)
		.values({
			name: name.trim(),
			nameNormalized,
			color: colorFor(nameNormalized),
			createdBy,
		})
		// Race-safe: if two requests create the same tag at once, fall back to the row.
		.onConflictDoNothing({ target: tags.nameNormalized })
		.returning();
	if (created) return created;

	const [row] = await db
		.select()
		.from(tags)
		.where(eq(tags.nameNormalized, nameNormalized))
		.limit(1);
	if (!row) throw new Error("tag upsert failed");
	return row;
}

/** Delete a tag entirely (removes it from every company via cascade). */
export async function deleteTag(db: DB, tagId: string): Promise<boolean> {
	const [deleted] = await db
		.delete(tags)
		.where(eq(tags.id, tagId))
		.returning({ id: tags.id });
	return !!deleted;
}

/** Attach a tag to a company. No-op if already attached. */
export async function tagCompany(
	db: DB,
	companyId: string,
	tagId: string,
	addedBy: string,
): Promise<void> {
	await db
		.insert(companyTags)
		.values({ companyId, tagId, addedBy })
		.onConflictDoNothing();
}

/** Remove a tag from a company. */
export async function untagCompany(
	db: DB,
	companyId: string,
	tagId: string,
): Promise<void> {
	await db
		.delete(companyTags)
		.where(
			and(eq(companyTags.companyId, companyId), eq(companyTags.tagId, tagId)),
		);
}
