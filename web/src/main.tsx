import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { ApiError } from "./lib/apiFetch.js";
import "./styles.css";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Don't retry auth failures; TanStack + apiFetch already handle token refresh.
			retry: (count, err) =>
				!(err instanceof ApiError && [401, 403].includes(err.status)) &&
				count < 1,
			staleTime: 15_000,
		},
	},
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</QueryClientProvider>
	</React.StrictMode>,
);
