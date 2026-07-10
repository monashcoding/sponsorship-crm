// mac-auth base. In prod the SPA is same-origin with its API; only the token fetch
// is cross-origin to auth.monashcoding.com (auto-trusted *.monashcoding.com subdomain).
export const AUTH_URL =
	(import.meta.env.VITE_AUTH_URL as string | undefined) ??
	"https://auth.monashcoding.com";

// Token held in memory only (never localStorage). Tokens live ~15 min; on a 401 we
// refetch once and retry, then bounce to sign-in.
let token: string | null = null;

export async function fetchToken(): Promise<string | null> {
	const r = await fetch(`${AUTH_URL}/api/auth/token`, {
		credentials: "include",
	});
	if (!r.ok) {
		token = null;
		return null;
	}
	token = ((await r.json()) as { token: string }).token;
	return token;
}

export function clearToken() {
	token = null;
}

export async function apiFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	if (!token) await fetchToken();
	const call = () =>
		fetch(path, {
			...init,
			headers: {
				...(init.headers ?? {}),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
		});

	let res = await call();
	if (res.status === 401) {
		// expired → one refresh + retry
		if (!(await fetchToken())) {
			location.assign("/signin");
			throw new Error("unauthenticated");
		}
		res = await call();
	}
	return res;
}

export class ApiError extends Error {
	constructor(
		public status: number,
		public body: unknown,
	) {
		super(`API ${status}`);
	}
}

/** JSON helper: throws ApiError (carrying the parsed body) on non-2xx. */
export async function apiJson<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const headers =
		init.body && !(init.headers as Record<string, string>)?.["Content-Type"]
			? { "Content-Type": "application/json", ...(init.headers ?? {}) }
			: init.headers;
	const res = await apiFetch(path, { ...init, headers });
	const text = await res.text();
	const body = text ? JSON.parse(text) : null;
	if (!res.ok) throw new ApiError(res.status, body);
	return body as T;
}
