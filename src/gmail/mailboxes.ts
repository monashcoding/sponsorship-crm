// The registry of shared inboxes the reply detector watches.
//
// Adding recruitment@ / events@ later is a two-line change here plus running the
// one-time OAuth script (npm run gmail:auth) signed in as that mailbox to mint its
// refresh token. Everything downstream (client, detector, job, sync-state) already
// loops over this list — no other file changes.
//
// Refresh tokens are secrets, so they live in env vars, not in code. Each mailbox
// names the env var that holds its token; a mailbox with no token set is simply
// skipped by the job (so sponsorship@ can go live before the other two exist).

export interface Mailbox {
	/** Stable id — also the primary key in gmail_sync_state. Never rename. */
	readonly key: string;
	/** The address that consented; must match the account you sign in as. */
	readonly email: string;
	/** Name of the env var holding this mailbox's OAuth refresh token. */
	readonly refreshTokenEnv: string;
}

export const MAILBOXES: readonly Mailbox[] = [
	{
		key: "sponsorship",
		email: "sponsorship@monashcoding.com",
		refreshTokenEnv: "GMAIL_SPONSORSHIP_REFRESH_TOKEN",
	},
	// { key: "recruitment", email: "recruitment@monashcoding.com", refreshTokenEnv: "GMAIL_RECRUITMENT_REFRESH_TOKEN" },
	// { key: "events",      email: "events@monashcoding.com",      refreshTokenEnv: "GMAIL_EVENTS_REFRESH_TOKEN" },
];

/** The refresh token for a mailbox, or undefined if it hasn't been authorized yet. */
export function mailboxRefreshToken(mb: Mailbox): string | undefined {
	return process.env[mb.refreshTokenEnv];
}

/** Only the mailboxes that have a refresh token configured — the ones the job runs. */
export function enabledMailboxes(): Mailbox[] {
	return MAILBOXES.filter((mb) => !!mailboxRefreshToken(mb));
}
