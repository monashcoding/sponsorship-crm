import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch, AUTH_URL, clearToken } from "../lib/apiFetch.js";
import type { Me } from "../lib/types.js";

async function signOut() {
  try {
    await fetch(`${AUTH_URL}/api/auth/sign-out`, { method: "POST", credentials: "include" });
  } finally {
    clearToken();
    location.assign("/signin");
  }
}

export function Layout({ me, children }: { me?: Me; children: ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">MAC Sponsorship CRM</div>
        <nav className="nav">
          <NavLink to="/" end>
            Pipeline
          </NavLink>
          <NavLink to="/follow-ups">Follow-ups</NavLink>
          <NavLink to="/reassign">Reassign</NavLink>
          <a href="/api/export/companies.csv" onClick={downloadCsv}>
            Export CSV
          </a>
        </nav>
        <div className="user">
          <span className="muted">{me?.name ?? me?.email}</span>
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

// CSV is a gated endpoint, so a plain <a href> won't carry the bearer token.
// Fetch it via apiFetch and trigger a client-side download.
function downloadCsv(e: React.MouseEvent) {
  e.preventDefault();
  void (async () => {
    const res = await apiFetch("/api/export/companies.csv");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "companies.csv";
    a.click();
    URL.revokeObjectURL(url);
  })();
}
