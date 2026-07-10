import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { fmtDateTime, isOverdue } from "../lib/dates.js";

export function FollowUpsPage() {
	const [overdueOnly, setOverdueOnly] = useState(false);
	const q = useQuery({
		queryKey: ["follow-ups", overdueOnly],
		queryFn: () => api.followUps(overdueOnly),
	});

	return (
		<div>
			<div className="page-head">
				<h1>Follow-ups</h1>
				<label className="checkbox">
					<input
						type="checkbox"
						checked={overdueOnly}
						onChange={(e) => setOverdueOnly(e.target.checked)}
					/>
					Overdue only
				</label>
			</div>

			{q.isLoading && <p className="muted">Loading…</p>}
			{q.data && (
				<table className="table">
					<thead>
						<tr>
							<th>Due</th>
							<th>Company</th>
							<th>Subject</th>
							<th>Channel</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{q.data.map((f) => (
							<tr
								key={f.touchpointId}
								className={isOverdue(f.nextFollowUpAt) ? "overdue-row" : ""}
							>
								<td>
									{isOverdue(f.nextFollowUpAt) && <span className="flag" />}{" "}
									{fmtDateTime(f.nextFollowUpAt)}
								</td>
								<td>
									<Link to={`/companies/${f.companyId}`}>{f.companyName}</Link>
								</td>
								<td>{f.subject ?? "—"}</td>
								<td>{f.channel}</td>
								<td>{f.currentStatus}</td>
							</tr>
						))}
						{q.data.length === 0 && (
							<tr>
								<td colSpan={5} className="muted">
									Nothing to follow up.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			)}
		</div>
	);
}
