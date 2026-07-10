import { eq } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { gmailSyncState } from "../db/schema.js";
import type { Mailbox } from "./mailboxes.js";

/** The stored checkpoint for a mailbox, or null if it's never been synced. */
export async function getSyncState(db: DB, mailbox: Mailbox) {
	const [row] = await db
		.select()
		.from(gmailSyncState)
		.where(eq(gmailSyncState.mailboxKey, mailbox.key))
		.limit(1);
	return row ?? null;
}

/** Upsert the mailbox's history cursor after a successful poll. */
export async function saveSyncState(
	db: DB,
	mailbox: Mailbox,
	lastHistoryId: string,
): Promise<void> {
	const now = new Date();
	await db
		.insert(gmailSyncState)
		.values({
			mailboxKey: mailbox.key,
			email: mailbox.email,
			lastHistoryId,
			lastSyncedAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: gmailSyncState.mailboxKey,
			set: {
				email: mailbox.email,
				lastHistoryId,
				lastSyncedAt: now,
				updatedAt: now,
			},
		});
}
