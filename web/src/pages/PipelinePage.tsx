import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AddCompanyModal } from "../components/AddCompanyModal.js";
import { TagChip, TagFilterBar } from "../components/Tags.js";
import { api } from "../lib/api.js";
import {
	type CompanyRow,
	STAGE_LABELS,
	STAGES,
	type Stage,
} from "../lib/types.js";

export function PipelinePage() {
	const qc = useQueryClient();
	const [view, setView] = useState<"board" | "table">("board");
	const [adding, setAdding] = useState(false);
	const [dragId, setDragId] = useState<string | null>(null);
	const [tagFilter, setTagFilter] = useState<string | null>(null);

	const pipeline = useQuery({
		queryKey: ["pipeline", tagFilter],
		queryFn: () => api.pipeline(tagFilter ?? undefined),
	});

	const move = useMutation({
		mutationFn: ({ id, stage }: { id: string; stage: Stage }) =>
			api.moveStage(id, stage),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["pipeline"] });
			void qc.invalidateQueries({ queryKey: ["companies"] });
		},
	});

	return (
		<div>
			<div className="page-head">
				<h1>Pipeline</h1>
				<div className="row-gap">
					<div className="toggle">
						<button
							type="button"
							className={view === "board" ? "active" : ""}
							onClick={() => setView("board")}
						>
							Board
						</button>
						<button
							type="button"
							className={view === "table" ? "active" : ""}
							onClick={() => setView("table")}
						>
							Table
						</button>
					</div>
					<button type="button" className="btn" onClick={() => setAdding(true)}>
						+ Add company
					</button>
				</div>
			</div>

			<TagFilterBar active={tagFilter} onChange={setTagFilter} />

			{pipeline.isLoading && <p className="muted">Loading…</p>}

			{pipeline.data && view === "board" && (
				<div className="board">
					{STAGES.map((stage) => (
						// biome-ignore lint/a11y/noStaticElementInteractions: HTML5 drag-and-drop target; the Table view is the keyboard-accessible alternative to the board
						<div
							key={stage}
							className="column"
							onDragOver={(e) => e.preventDefault()}
							onDrop={() => {
								if (dragId) move.mutate({ id: dragId, stage });
								setDragId(null);
							}}
						>
							<div className="column-head">
								{STAGE_LABELS[stage]}
								<span className="count">
									{pipeline.data[stage]?.length ?? 0}
								</span>
							</div>
							{pipeline.data[stage]?.map((c) => (
								<CompanyCard
									key={c.id}
									company={c}
									onDragStart={() => setDragId(c.id)}
								/>
							))}
						</div>
					))}
				</div>
			)}

			{pipeline.data && view === "table" && (
				<table className="table">
					<thead>
						<tr>
							<th>Company</th>
							<th>Stage</th>
							<th>Tags</th>
							<th>Reply</th>
							<th>Overdue</th>
						</tr>
					</thead>
					<tbody>
						{STAGES.flatMap((s) => pipeline.data[s] ?? []).map((c) => (
							<tr key={c.id}>
								<td>
									<Link to={`/companies/${c.id}`}>{c.name}</Link>
								</td>
								<td>{STAGE_LABELS[c.stage]}</td>
								<td>
									<div className="tag-list">
										{c.tags.map((t) => (
											<TagChip key={t.id} tag={t} />
										))}
									</div>
								</td>
								<td>{c.hasReply ? "✅" : ""}</td>
								<td>{c.overdue ? "⚠️" : ""}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			{adding && <AddCompanyModal onClose={() => setAdding(false)} />}
		</div>
	);
}

function CompanyCard({
	company,
	onDragStart,
}: {
	company: CompanyRow;
	onDragStart: () => void;
}) {
	return (
		<Link
			to={`/companies/${company.id}`}
			className="card company-card"
			draggable
			onDragStart={onDragStart}
		>
			<div className="company-name">{company.name}</div>
			<div className="card-meta">
				{company.hasReply && (
					<span className="dot dot-reply" title="Has reply" />
				)}
				{company.overdue && <span className="flag" title="Overdue follow-up" />}
				{company.industry && <span className="muted">{company.industry}</span>}
			</div>
			{company.tags.length > 0 && (
				<div className="tag-list">
					{company.tags.map((t) => (
						<TagChip key={t.id} tag={t} />
					))}
				</div>
			)}
		</Link>
	);
}
