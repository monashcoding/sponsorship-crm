import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { Forbidden } from "./auth/Forbidden.js";
import { SignIn } from "./auth/SignIn.js";
import { Layout } from "./components/Layout.js";
import { api } from "./lib/api.js";
import { ApiError } from "./lib/apiFetch.js";
import type { Me } from "./lib/types.js";
import { CompanyPage } from "./pages/CompanyPage.js";
import { FollowUpsPage } from "./pages/FollowUpsPage.js";
import { PipelinePage } from "./pages/PipelinePage.js";
import { ReassignPage } from "./pages/ReassignPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/*" element={<Gate />} />
    </Routes>
  );
}

function Gate() {
  const me = useQuery<Me>({ queryKey: ["me"], queryFn: api.me, retry: false });

  if (me.isLoading) return <div className="center muted">Loading…</div>;

  if (me.isError) {
    const err = me.error;
    if (err instanceof ApiError && err.status === 403) {
      const body = err.body as { message?: string } | null;
      return <Forbidden message={body?.message} />;
    }
    return <SignIn />;
  }

  return (
    <Layout me={me.data}>
      <Routes>
        <Route path="/" element={<PipelinePage />} />
        <Route path="/companies/:id" element={<CompanyPage />} />
        <Route path="/follow-ups" element={<FollowUpsPage />} />
        <Route path="/reassign" element={<ReassignPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
