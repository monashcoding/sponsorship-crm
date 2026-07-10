import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal } from "../components/Modal.js";
import { api } from "../lib/api.js";
import type { Member } from "../lib/types.js";

export function ReassignPage() {
	const qc = useQueryClient();
	const members = useQuery({ queryKey: ["members"], queryFn: api.members });
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [confirming, setConfirming] = useState(false);

	const run = useMutation({
		mutationFn: () => api.reassign(from, to),
		onSuccess: () => {
			setConfirming(false);
			void qc.invalidateQueries();
		},
	});

	const label = (m: Member) => m.name ?? m.email;

	return (
		<div className="narrow">
			<h1>Reassign ownership</h1>
			<p className="muted">
				Transfers <strong>all</strong> companies and touchpoints owned by one
				committee member to another (end-of-year handover). Attribution (
				<code>created_by</code>) is preserved.
			</p>

			{members.data && (
				<div className="form">
					<label>
						From
						<select value={from} onChange={(e) => setFrom(e.target.value)}>
							<option value="">Select…</option>
							{members.data.map((m) => (
								<option key={m.macUserId} value={m.macUserId}>
									{label(m)}
								</option>
							))}
						</select>
					</label>
					<label>
						To
						<select value={to} onChange={(e) => setTo(e.target.value)}>
							<option value="">Select…</option>
							{members.data.map((m) => (
								<option key={m.macUserId} value={m.macUserId}>
									{label(m)}
								</option>
							))}
						</select>
					</label>
					<div className="form-actions">
						<button
							type="button"
							className="btn btn-warn"
							disabled={!from || !to || from === to}
							onClick={() => setConfirming(true)}
						>
							Reassign…
						</button>
					</div>
				</div>
			)}

			{run.data && (
				<p className="ok">
					Moved {run.data.companiesMoved} companies and{" "}
					{run.data.touchpointsMoved} touchpoints.
				</p>
			)}

			{confirming && (
				<Modal
					title="Confirm reassignment"
					onClose={() => setConfirming(false)}
				>
					<p>
						This will move every company and touchpoint owned by the selected
						member. This cannot be undone automatically (though it is logged).
					</p>
					<div className="form-actions">
						<button
							type="button"
							className="btn btn-ghost"
							onClick={() => setConfirming(false)}
						>
							Cancel
						</button>
						<button
							type="button"
							className="btn btn-warn"
							onClick={() => run.mutate()}
							disabled={run.isPending}
						>
							{run.isPending ? "Reassigning…" : "Confirm reassign"}
						</button>
					</div>
				</Modal>
			)}
		</div>
	);
}
