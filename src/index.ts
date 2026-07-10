import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import { ZodError } from "zod";
import { env } from "./env.js";
import { HttpError } from "./http.js";
import { requireCommittee } from "./middleware/auth.js";
import { api } from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/index.js → repo root is one level up; SPA bundle lives at web/dist.
const WEB_DIST = path.resolve(__dirname, "../web/dist");

// Migrations run as a separate process before this one (see Dockerfile CMD:
// `node dist/db/migrate.js && node dist/index.js`). Locally: `npm run db:migrate`.
async function main() {
	const app = express();
	app.use(express.json());

	// Ungated health check.
	app.get("/health", (_req, res) => res.json({ status: "ok" }));

	// Entire API is committee-gated.
	app.use("/api", requireCommittee, api);

	// Serve the built SPA (same-origin with the API → no CORS for app calls).
	if (existsSync(WEB_DIST)) {
		app.use(express.static(WEB_DIST));
		// SPA fallback: any non-/api, non-/health GET returns index.html for client routing.
		app.get(/^(?!\/api|\/health).*/, (_req, res) => {
			res.sendFile(path.join(WEB_DIST, "index.html"));
		});
	}

	// Error handler: Zod → 422, HttpError → its status, else 500.
	app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
		if (err instanceof ZodError) {
			return res
				.status(422)
				.json({ error: "invalid_request", issues: err.issues });
		}
		if (err instanceof HttpError) {
			return res
				.status(err.status)
				.json({ error: err.message, ...err.payload });
		}
		console.error("unhandled error", err);
		res.status(500).json({ error: "internal_error" });
	});

	app.listen(env.PORT, () => {
		console.log(`mac-sponsorship-crm listening on :${env.PORT}`);
	});
}

main().catch((err) => {
	console.error("fatal startup error", err);
	process.exit(1);
});
