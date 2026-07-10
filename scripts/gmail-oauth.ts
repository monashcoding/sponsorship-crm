/**
 * One-time OAuth consent → refresh token, run once per mailbox. Never runs in prod.
 *
 *     npm run gmail:auth
 *
 * It opens a Google sign-in URL. IMPORTANT: sign in as the mailbox you want to read
 * (e.g. sponsorship@monashcoding.com), NOT your personal account — the refresh token
 * is bound to whoever consents and only reads that account's mail.
 *
 * On success it prints a refresh token. Put it in the app's environment as the var
 * named by that mailbox in src/gmail/mailboxes.ts, e.g.:
 *
 *     GMAIL_SPONSORSHIP_REFRESH_TOKEN=<printed value>
 *
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set (from the Desktop-app OAuth
 * client). Reads .env if you run it via tsx with your env loaded.
 */

import { createServer } from "node:http";
import { GMAIL_SCOPES, makeOAuthClient } from "../src/gmail/client.js";

const PORT = 4567;
const REDIRECT_URI = `http://localhost:${PORT}`;

async function main() {
	const oauth = makeOAuthClient(REDIRECT_URI);

	const authUrl = oauth.generateAuthUrl({
		access_type: "offline", // ask for a refresh token
		prompt: "consent", // force it to be re-issued even on re-auth
		scope: GMAIL_SCOPES,
	});

	console.log("\n1) Open this URL and sign in AS THE MAILBOX you want to read:\n");
	console.log(`   ${authUrl}\n`);
	console.log(`2) After approving, Google redirects to ${REDIRECT_URI} and this`);
	console.log("   script captures the code automatically.\n");

	const code = await waitForCode();
	const { tokens } = await oauth.getToken(code);

	if (!tokens.refresh_token) {
		console.error(
			"\nNo refresh_token returned. This usually means you've authorized before.\n" +
				"Revoke the app at https://myaccount.google.com/permissions (while signed in\n" +
				"as the mailbox) and run this again.\n",
		);
		process.exit(1);
	}

	console.log("\n✅ Success. Add this to the app environment:\n");
	console.log(`   GMAIL_<MAILBOX>_REFRESH_TOKEN=${tokens.refresh_token}\n`);
	console.log(
		"   (e.g. GMAIL_SPONSORSHIP_REFRESH_TOKEN — match the mailbox in src/gmail/mailboxes.ts)\n",
	);
}

/** Spin up a throwaway loopback server to catch Google's redirect with ?code=. */
function waitForCode(): Promise<string> {
	return new Promise((resolve, reject) => {
		const server = createServer((req, res) => {
			const url = new URL(req.url ?? "", REDIRECT_URI);
			const code = url.searchParams.get("code");
			const error = url.searchParams.get("error");
			res.setHeader("content-type", "text/html");
			if (code) {
				res.end("<h2>Authorized. You can close this tab and return to the terminal.</h2>");
				server.close();
				resolve(code);
			} else {
				res.end(`<h2>Authorization failed: ${error ?? "no code"}</h2>`);
				server.close();
				reject(new Error(error ?? "no code in redirect"));
			}
		});
		server.listen(PORT, () => {
			console.log(`   (listening on ${REDIRECT_URI} for the redirect…)`);
		});
	});
}

main().catch((err) => {
	console.error("gmail:auth failed:", err);
	process.exit(1);
});
