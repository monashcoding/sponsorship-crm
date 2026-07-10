import type { NextFunction, Request, Response } from "express";
import type { MacClaims } from "./verify.js";

// Augment Express's Request with the verified claims set by requireCommittee.
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			claims?: MacClaims;
		}
	}
}

/** The claims are guaranteed present downstream of requireCommittee. */
export function claimsOf(req: Request): MacClaims {
	if (!req.claims)
		throw new Error("claims missing — route not gated by requireCommittee");
	return req.claims;
}

/** Required route param (Express types params as possibly-undefined under strict indexing). */
export function param(req: Request, name: string): string {
	const v = req.params[name];
	if (v === undefined) throw new HttpError(400, `missing route param: ${name}`);
	return v;
}

/** Wraps an async handler so rejected promises reach Express's error middleware. */
export function asyncHandler(
	fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
	return (req: Request, res: Response, next: NextFunction) => {
		fn(req, res, next).catch(next);
	};
}

export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
		public payload?: Record<string, unknown>,
	) {
		super(message);
	}
}
