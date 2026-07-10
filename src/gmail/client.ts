import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";
import { env } from "../env.js";
import { type Mailbox, mailboxRefreshToken } from "./mailboxes.js";

// Read-only: reply detection never sends or modifies mail. If you ever add
// outbound auto-logging, that's a DIFFERENT, broader scope and a re-consent.
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

/** Throws a clear error if the OAuth client credentials aren't configured. */
function requireOAuthConfig(): { clientId: string; clientSecret: string } {
	if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
		throw new Error(
			"Gmail is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET " +
				"(from the Google Cloud OAuth client). See README → Gmail reply detection.",
		);
	}
	return {
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET,
	};
}

/**
 * A bare OAuth2 client (no refresh token yet) — used by the one-time auth script
 * to run the consent flow. `redirectUri` is a loopback URL for the Desktop-app
 * OAuth client type.
 */
export function makeOAuthClient(redirectUri: string) {
	const { clientId, clientSecret } = requireOAuthConfig();
	return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * A Gmail API client authenticated as `mailbox`, using its stored refresh token.
 * The google-auth-library transparently exchanges the refresh token for a fresh
 * access token as needed — no sign-in, no interaction. This is what the cron uses.
 */
export function gmailClientFor(mailbox: Mailbox): gmail_v1.Gmail {
	const { clientId, clientSecret } = requireOAuthConfig();
	const refreshToken = mailboxRefreshToken(mailbox);
	if (!refreshToken) {
		throw new Error(
			`Mailbox "${mailbox.key}" has no refresh token: set ${mailbox.refreshTokenEnv}. ` +
				"Run `npm run gmail:auth` signed in as " +
				`${mailbox.email} to mint one.`,
		);
	}
	const auth = new google.auth.OAuth2(clientId, clientSecret);
	auth.setCredentials({ refresh_token: refreshToken });
	return google.gmail({ version: "v1", auth });
}
