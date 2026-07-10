/**
 * MAC token verifier — copied from mac-auth's examples/verify.ts (the canonical source).
 * Verifies a Better Auth JWT locally against the auth service's JWKS. The JWKS is fetched
 * once and cached by `createRemoteJWKSet`, so verifying a token does NOT call auth per
 * request. Only dependency: `jose`.
 *
 * If mac-auth changes its claim shape, re-copy its examples/verify.ts over this file.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./env.js";

const ISSUER = env.JWT_ISSUER; // == AUTH_URL
const AUDIENCE = env.JWT_AUDIENCE;

// Cached remote JWKS (Ed25519 public keys). Reused across calls — do NOT recreate per request.
const JWKS = createRemoteJWKSet(new URL(`${env.AUTH_URL}/api/auth/jwks`));

/** The claims a verified MAC token is guaranteed to carry. */
export interface MacClaims {
	macUserId: string;
	email: string;
	roles: string[];
	/** Functional team (e.g. "Events"), or null if the person isn't on the committee roster. */
	team: string | null;
	ver: number;
	/**
	 * Display name. NOT in the current MAC token contract — it arrives only once mac-auth's
	 * roster/claims extension adds a `name` claim (see the CRM spec's SPEC_roster_and_claims.md
	 * dependency). Read forward-compatibly here: it's `undefined` today, and every consumer
	 * falls back to `email`, so it lights up automatically with zero code change when auth
	 * ships it. Do not gate anything on it.
	 */
	name?: string;
}

/**
 * Verify a MAC-issued JWT. Throws if the signature, issuer, audience, or expiry (`exp`)
 * is invalid. Returns the typed MAC claims on success.
 */
export async function verifyMacToken(
	token: string | undefined,
): Promise<MacClaims> {
	if (!token) throw new Error("missing token");

	const { payload } = await jwtVerify(token, JWKS, {
		issuer: ISSUER, // checks `iss`
		audience: AUDIENCE, // checks `aud`
		// `exp` is enforced by jwtVerify automatically.
	});

	return {
		macUserId: payload.macUserId as string,
		email: payload.email as string,
		roles: (payload.roles as string[]) ?? [],
		team: (payload.team as string | null) ?? null,
		ver: (payload.ver as number) ?? 1,
		name: (payload.name as string | undefined) ?? undefined,
	};
}
