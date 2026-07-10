function required(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`Missing required environment variable: ${name}`);
	return v;
}

export const env = {
	DATABASE_URL: required("DATABASE_URL"),
	AUTH_URL: process.env.AUTH_URL ?? "https://auth.monashcoding.com",
	JWT_ISSUER: process.env.JWT_ISSUER ?? "https://auth.monashcoding.com",
	JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? "mac-suite",
	PORT: Number(process.env.PORT ?? 3000),
	NODE_ENV: process.env.NODE_ENV ?? "development",

	// --- Gmail reply detection (optional) ------------------------------------
	// The web server does NOT need these; only the gmail sync job + oauth script do.
	// Left undefined, the job refuses to run with a clear message. One OAuth client
	// (Internal app on the monashcoding.com Workspace) is shared by every mailbox;
	// each mailbox has its own refresh token (see src/gmail/mailboxes.ts).
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	// How many days of inbox to backfill on a mailbox's very first sync.
	GMAIL_SEED_WINDOW_DAYS: Number(process.env.GMAIL_SEED_WINDOW_DAYS ?? 3),
};
