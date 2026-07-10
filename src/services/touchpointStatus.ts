import type { DBorTx } from "../db/client.js";
import type { TouchpointStatus } from "../db/schema.js";
import { touchpointEvents } from "../db/schema.js";

// The ONLY writer of touchpoint status (§6). Manual now; a future GmailReplyDetector
// feeds the same choke point with source:"gmail". The pipeline reads current status
// and never knows which caller wrote it. Accepts a tx so the initial "sent" event can
// be written atomically with its touchpoint.
export async function recordTouchpointStatus(
	db: DBorTx,
	input: {
		touchpointId: string;
		status: TouchpointStatus;
		source: "manual" | "gmail";
		note?: string;
		by?: string; // macUserId for manual; undefined for automated
	},
): Promise<void> {
	await db.insert(touchpointEvents).values({
		touchpointId: input.touchpointId,
		status: input.status,
		source: input.source,
		note: input.note ?? null,
		by: input.by ?? null,
	});
}

// Future pluggable detectors implement this; MANUAL needs no detector.
// A future GmailReplyDetector.poll() matches inbound mail to contacts, filters OOO
// auto-replies, and passes results to recordTouchpointStatus with source:"gmail".
// DO NOT BUILD NOW.
export interface ReplyDetector {
	readonly source: "gmail";
	poll(): Promise<
		Array<{ touchpointId: string; status: "replied"; note?: string }>
	>;
}
