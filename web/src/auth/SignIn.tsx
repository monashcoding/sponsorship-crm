import { AUTH_URL } from "../lib/apiFetch.js";

async function signInSocial(provider: "google" | "microsoft") {
  const r = await fetch(`${AUTH_URL}/api/auth/sign-in/social`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, callbackURL: `${window.location.origin}/` }),
  });
  const data = (await r.json()) as { url?: string };
  if (data.url) location.assign(data.url);
}

export function SignIn() {
  return (
    <div className="center">
      <div className="card auth-card">
        <h1>MAC Sponsorship CRM</h1>
        <p className="muted">Sign in with your committee account.</p>
        <button type="button" className="btn btn-block" onClick={() => signInSocial("google")}>
          Continue with Google
        </button>
        <button type="button" className="btn btn-block" onClick={() => signInSocial("microsoft")}>
          Continue with Microsoft
        </button>
      </div>
    </div>
  );
}
