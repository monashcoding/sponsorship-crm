/**
 * Gmail reply-detection job. Runs on a schedule (cron / Dokploy scheduled task):
 *
 *     node dist/jobs/gmailSync.js
 *
 * For each authorized mailbox it polls Gmail incrementally, resolves inbound replies
 * and bounces to touchpoints, and feeds them through recordTouchpointStatus with
 * source:"gmail" — the SAME choke point manual updates use (see touchpointStatus.ts).
 * The rest of the app can't tell a human from the poller; that's the whole design.
 *
 * Safe to run when nothing is configured: with no GOOGLE_CLIENT_* or no mailbox
 * refresh tokens it logs that it's idle and exits 0, so it can be wired into cron
 * before the OAuth step is done.
 */

import { client, db } from "../db/client.js";
import { env } from "../env.js";
import { enabledMailboxes } from "../gmail/mailboxes.js";
import { GmailReplyDetector } from "../gmail/replyDetector.js";
import { saveSyncState } from "../gmail/syncState.js";
import { recordTouchpointStatus } from "../services/touchpointStatus.js";

async function syncMailbox(
	mailbox: ReturnType<typeof enabledMailboxes>[number],
) {
	const detector = new GmailReplyDetector(db, mailbox);
	const detected = await detector.poll();

	for (const d of detected) {
		// source:"gmail", by:undefined → recorded as an automated event.
		await recordTouchpointStatus(db, {
			touchpointId: d.touchpointId,
			status: d.status,
			source: "gmail",
			note: d.note,
		});
	}

	// Advance the cursor only after every detected status is safely written, so a
	// crash mid-run just re-processes (idempotent) rather than skipping messages.
	if (detector.nextHistoryId) {
		await saveSyncState(db, mailbox, detector.nextHistoryId);
	}

	console.log(
		`[gmail-sync] ${mailbox.key}: recorded ${detected.length} status update(s)`,
	);
}

async function main() {
	if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
		console.log("[gmail-sync] GOOGLE_CLIENT_* not set — nothing to do.");
		return;
	}
	const mailboxes = enabledMailboxes();
	if (mailboxes.length === 0) {
		console.log(
			"[gmail-sync] no mailbox refresh tokens configured — nothing to do.",
		);
		return;
	}

	console.log(
		`[gmail-sync] polling ${mailboxes.length} mailbox(es): ${mailboxes
			.map((m) => m.key)
			.join(", ")}`,
	);

	// One mailbox's failure (e.g. a revoked token) must not stop the others.
	let failures = 0;
	for (const mailbox of mailboxes) {
		try {
			await syncMailbox(mailbox);
		} catch (err) {
			failures++;
			console.error(`[gmail-sync] ${mailbox.key} failed:`, err);
		}
	}
	if (failures > 0) process.exitCode = 1;
}

main()
	.catch((err) => {
		console.error("[gmail-sync] fatal:", err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await client.end();
	});
