import { clearToken } from "../lib/apiFetch.js";

export function Forbidden({ message }: { message?: string }) {
	return (
		<div className="center">
			<div className="card auth-card">
				<h1>Committee access needed</h1>
				<p className="muted">
					{message ??
						"Your session doesn't currently show committee access. If you are on the committee, sign out and back in; if it persists, check the Notion roster."}
				</p>
				<button
					type="button"
					className="btn btn-block"
					onClick={() => {
						clearToken();
						location.assign("/signin");
					}}
				>
					Sign out and try again
				</button>
			</div>
		</div>
	);
}
