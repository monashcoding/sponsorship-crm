import { and, desc, eq, sql } from "drizzle-orm";
import type { gmail_v1 } from "googleapis";
import type { DB } from "../db/client.js";
import { contacts, touchpoints } from "../db/schema.js";
import { env } from "../env.js";
import type {
	DetectedStatus,
	ReplyDetector,
} from "../services/touchpointStatus.js";
import { gmailClientFor } from "./client.js";
import type { Mailbox } from "./mailboxes.js";
import { getSyncState } from "./syncState.js";

// Headers we ask Gmail for (format: "metadata" — we never download message bodies,
// keeping with the app's minimal-retention stance: we read WHO replied, not WHAT).
const METADATA_HEADERS = [
	"From",
	"Auto-Submitted",
	"Precedence",
	"X-Autoreply",
	"X-Autorespond",
	"X-Failed-Recipients",
];

// Safety cap so a first-ever seed (or a long outage) can't fetch unbounded mail.
const MAX_MESSAGES_PER_RUN = 200;

type Classification =
	| { kind: "reply"; from: string }
	| { kind: "bounce"; failedRecipient: string | null }
	| { kind: "ignore" }; // out-of-office / auto-reply / own sent mail / unparseable

export class GmailReplyDetector implements ReplyDetector {
	readonly source = "gmail" as const;

	/** Set by poll(); the job persists it via saveSyncState() only after a clean run. */
	nextHistoryId: string | null = null;

	constructor(
		private readonly db: DB,
		private readonly mailbox: Mailbox,
	) {}

	async poll(): Promise<DetectedStatus[]> {
		const gmail = gmailClientFor(this.mailbox);
		const state = await getSyncState(this.db, this.mailbox);

		const { messageIds, newHistoryId } = state?.lastHistoryId
			? await this.messagesSince(gmail, state.lastHistoryId)
			: await this.seedRecent(gmail);

		this.nextHistoryId = newHistoryId;

		const detected: DetectedStatus[] = [];
		for (const id of messageIds.slice(0, MAX_MESSAGES_PER_RUN)) {
			const match = await this.classifyAndMatch(gmail, id);
			if (match) detected.push(match);
		}
		return detected;
	}

	// --- Fetching new message ids ------------------------------------------

	/** Incremental: everything added since the stored history cursor. */
	private async messagesSince(
		gmail: gmail_v1.Gmail,
		startHistoryId: string,
	): Promise<{ messageIds: string[]; newHistoryId: string }> {
		const ids = new Set<string>();
		let pageToken: string | undefined;
		let newHistoryId = startHistoryId;
		try {
			do {
				const { data } = await gmail.users.history.list({
					userId: "me",
					startHistoryId,
					historyTypes: ["messageAdded"],
					pageToken,
				});
				if (data.historyId) newHistoryId = data.historyId;
				for (const h of data.history ?? []) {
					for (const added of h.messagesAdded ?? []) {
						const m = added.message;
						// Skip our own sent mail and drafts without a metadata fetch.
						const labels = m?.labelIds ?? [];
						if (labels.includes("SENT") || labels.includes("DRAFT")) continue;
						if (m?.id) ids.add(m.id);
					}
				}
				pageToken = data.nextPageToken ?? undefined;
			} while (pageToken);
		} catch (err: unknown) {
			// A 404 means startHistoryId is too old (Gmail prunes history). Fall back to
			// a bounded re-seed so we recover instead of getting stuck.
			if (isNotFound(err)) return this.seedRecent(gmail);
			throw err;
		}
		return { messageIds: [...ids], newHistoryId };
	}

	/** First run (or history-too-old recovery): a bounded window of recent inbox mail. */
	private async seedRecent(
		gmail: gmail_v1.Gmail,
	): Promise<{ messageIds: string[]; newHistoryId: string }> {
		const days = env.GMAIL_SEED_WINDOW_DAYS;
		const { data } = await gmail.users.messages.list({
			userId: "me",
			q: `newer_than:${days}d -in:sent -in:chats`,
			maxResults: MAX_MESSAGES_PER_RUN,
		});
		const messageIds = (data.messages ?? [])
			.map((m) => m.id)
			.filter((id): id is string => !!id);

		// Anchor the cursor at "now" so the next run is incremental from here.
		const { data: profile } = await gmail.users.getProfile({ userId: "me" });
		const newHistoryId = profile.historyId ?? "";
		return { messageIds, newHistoryId };
	}

	// --- Classify one message + resolve it to a touchpoint -----------------

	private async classifyAndMatch(
		gmail: gmail_v1.Gmail,
		messageId: string,
	): Promise<DetectedStatus | null> {
		const { data } = await gmail.users.messages.get({
			userId: "me",
			id: messageId,
			format: "metadata",
			metadataHeaders: METADATA_HEADERS,
		});
		if ((data.labelIds ?? []).includes("SENT")) return null;

		const headers = data.payload?.headers ?? [];
		const cls = classify(headers);

		if (cls.kind === "ignore") return null;

		if (cls.kind === "bounce") {
			if (!cls.failedRecipient) return null; // can't tell who bounced — skip
			const tpId = await this.awaitingTouchpoint(
				cls.failedRecipient,
				"bounced",
			);
			if (!tpId) return null;
			return {
				touchpointId: tpId,
				status: "bounced",
				note: `Gmail: delivery failure to ${cls.failedRecipient}`,
			};
		}

		// Genuine inbound reply.
		const tpId = await this.awaitingTouchpoint(cls.from, "replied");
		if (!tpId) return null;
		return {
			touchpointId: tpId,
			status: "replied",
			note: `Gmail: reply from ${cls.from}`,
		};
	}

	/**
	 * The touchpoint a status should attach to: the most recent EMAIL touchpoint for
	 * the contact with this address whose current status isn't already `status`
	 * (the IS DISTINCT FROM guard makes repeated polls idempotent — no duplicate rows).
	 *
	 * v1 matches by contact email only. When outbound auto-logging lands and touchpoints
	 * carry a Gmail threadId, prefer a thread match here for precision across multiple
	 * open touchpoints to the same contact.
	 */
	private async awaitingTouchpoint(
		email: string,
		status: "replied" | "bounced",
	): Promise<string | null> {
		const [row] = await this.db
			.select({ id: touchpoints.id })
			.from(touchpoints)
			.innerJoin(contacts, eq(contacts.id, touchpoints.contactId))
			.where(
				and(
					sql`lower(${contacts.email}) = ${email.toLowerCase()}`,
					eq(touchpoints.channel, "email"),
					sql`(
						SELECT te.status FROM touchpoint_events te
						WHERE te.touchpoint_id = ${touchpoints.id}
						ORDER BY te.at DESC, te.id DESC LIMIT 1
					) IS DISTINCT FROM ${status}`,
				),
			)
			.orderBy(desc(touchpoints.sentAt))
			.limit(1);
		return row?.id ?? null;
	}
}

// --- Pure header logic (unit-testable, no I/O) -----------------------------

type Header = gmail_v1.Schema$MessagePartHeader;

export function classify(headers: Header[]): Classification {
	const from = getHeader(headers, "From");
	const fromEmail = from ? parseEmail(from) : null;

	// Bounces / delivery-status notifications come from the mail system, and name the
	// original recipient in X-Failed-Recipients.
	if (fromEmail && isMailerDaemon(fromEmail)) {
		return {
			kind: "bounce",
			failedRecipient: parseEmail(
				getHeader(headers, "X-Failed-Recipients") ?? "",
			),
		};
	}

	// Out-of-office / vacation / auto-responders — never count as a real reply.
	if (isAutoReply(headers)) return { kind: "ignore" };

	if (!fromEmail) return { kind: "ignore" };
	return { kind: "reply", from: fromEmail };
}

function getHeader(headers: Header[], name: string): string | null {
	const lower = name.toLowerCase();
	return headers.find((h) => h.name?.toLowerCase() === lower)?.value ?? null;
}

/** Extract a bare address from a header value like `"Jane Doe" <jane@acme.com>`. */
export function parseEmail(value: string): string | null {
	const angle = value.match(/<([^>]+)>/);
	const raw = (angle?.[1] ?? value).trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;
}

function isMailerDaemon(email: string): boolean {
	const local = email.split("@")[0] ?? "";
	return local === "mailer-daemon" || local === "postmaster";
}

function isAutoReply(headers: Header[]): boolean {
	const autoSubmitted = getHeader(headers, "Auto-Submitted");
	if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") return true; // RFC 3834
	if (getHeader(headers, "X-Autoreply")) return true;
	if (getHeader(headers, "X-Autorespond")) return true;
	const precedence = (getHeader(headers, "Precedence") ?? "").toLowerCase();
	if (precedence === "auto_reply" || precedence === "bulk") return true;
	return false;
}

function isNotFound(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		(err as { code?: number }).code === 404
	);
}
