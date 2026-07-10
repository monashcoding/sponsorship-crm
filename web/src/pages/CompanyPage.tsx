import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CompanyTagsEditor } from "../components/Tags.js";
import { api } from "../lib/api.js";
import {
	fmtDate,
	fmtDateTime,
	isOverdue,
	localInputToISO,
} from "../lib/dates.js";
import {
	STAGE_LABELS,
	STAGES,
	STATUSES,
	type Stage,
	type Touchpoint,
	type TouchpointStatus,
} from "../lib/types.js";

export function CompanyPage() {
	const { id = "" } = useParams();
	const qc = useQueryClient();
	const detail = useQuery({
		queryKey: ["company", id],
		queryFn: () => api.company(id),
	});

	const invalidate = () => {
		void qc.invalidateQueries({ queryKey: ["company", id] });
		void qc.invalidateQueries({ queryKey: ["pipeline"] });
	};

	const stage = useMutation({
		mutationFn: (s: Stage) => api.moveStage(id, s),
		onSuccess: invalidate,
	});

	if (detail.isLoading) return <p className="muted">Loading…</p>;
	if (detail.isError || !detail.data) return <p>Company not found.</p>;

	const { company, contacts, touchpoints, stageHistory, tags } = detail.data;

	return (
		<div className="detail">
			<div className="page-head">
				<div>
					<Link to="/" className="muted">
						← Pipeline
					</Link>
					<h1>{company.name}</h1>
				</div>
				<label className="stage-select">
					Stage
					<select
						value={company.stage}
						onChange={(e) => stage.mutate(e.target.value as Stage)}
					>
						{STAGES.map((s) => (
							<option key={s} value={s}>
								{STAGE_LABELS[s]}
							</option>
						))}
					</select>
				</label>
			</div>

			<CompanyFields
				id={id}
				website={company.website}
				industry={company.industry}
				notes={company.notes}
				onSaved={invalidate}
			/>

			<StageStrip history={stageHistory} />

			<section className="card">
				<h2>Tags</h2>
				<CompanyTagsEditor companyId={id} tags={tags} onChange={invalidate} />
			</section>

			<section className="card">
				<h2>Contacts</h2>
				<Contacts companyId={id} contacts={contacts} onChange={invalidate} />
			</section>

			<section className="card">
				<h2>Touchpoints</h2>
				<AddTouchpoint companyId={id} onAdded={invalidate} />
				<Timeline touchpoints={touchpoints} onChange={invalidate} />
			</section>
		</div>
	);
}

function CompanyFields({
	id,
	website,
	industry,
	notes,
	onSaved,
}: {
	id: string;
	website: string | null;
	industry: string | null;
	notes: string | null;
	onSaved: () => void;
}) {
	const [w, setW] = useState(website ?? "");
	const [ind, setInd] = useState(industry ?? "");
	const [n, setN] = useState(notes ?? "");
	const save = useMutation({
		mutationFn: () =>
			api.patchCompany(id, {
				website: w || null,
				industry: ind || null,
				notes: n || null,
			}),
		onSuccess: onSaved,
	});

	return (
		<section className="card">
			<div className="form">
				<label>
					Website
					<input value={w} onChange={(e) => setW(e.target.value)} />
				</label>
				<label>
					Industry
					<input value={ind} onChange={(e) => setInd(e.target.value)} />
				</label>
				<label>
					Notes
					<textarea value={n} onChange={(e) => setN(e.target.value)} rows={3} />
				</label>
				<div className="form-actions">
					<button
						type="button"
						className="btn"
						onClick={() => save.mutate()}
						disabled={save.isPending}
					>
						{save.isPending ? "Saving…" : "Save"}
					</button>
				</div>
			</div>
		</section>
	);
}

function StageStrip({
	history,
}: {
	history: {
		id: string;
		fromStage: Stage | null;
		toStage: Stage;
		changedAt: string;
	}[];
}) {
	if (history.length === 0) return null;
	return (
		<div className="stage-strip">
			{history.map((h) => (
				<span key={h.id} className="chip">
					{h.fromStage ? `${STAGE_LABELS[h.fromStage]} → ` : ""}
					{STAGE_LABELS[h.toStage]}
					<span className="muted"> · {fmtDate(h.changedAt)}</span>
				</span>
			))}
		</div>
	);
}

function Contacts({
	companyId,
	contacts,
	onChange,
}: {
	companyId: string;
	contacts: {
		id: string;
		name: string;
		email: string | null;
		role: string | null;
		linkedin: string | null;
	}[];
	onChange: () => void;
}) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [role, setRole] = useState("");
	const add = useMutation({
		mutationFn: () =>
			api.addContact(companyId, {
				name,
				email: email || null,
				role: role || null,
			}),
		onSuccess: () => {
			setName("");
			setEmail("");
			setRole("");
			onChange();
		},
	});
	const del = useMutation({
		mutationFn: (cid: string) => api.deleteContact(cid),
		onSuccess: onChange,
	});

	return (
		<div>
			<ul className="contact-list">
				{contacts.map((c) => (
					<li key={c.id}>
						<span>
							<strong>{c.name}</strong>
							{c.role && <span className="muted"> · {c.role}</span>}
							{c.email && <span className="muted"> · {c.email}</span>}
						</span>
						<button
							type="button"
							className="btn btn-ghost"
							onClick={() => del.mutate(c.id)}
						>
							Delete
						</button>
					</li>
				))}
			</ul>
			<form
				className="inline-form"
				onSubmit={(e) => {
					e.preventDefault();
					if (name) add.mutate();
				}}
			>
				<input
					placeholder="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<input
					placeholder="Role"
					value={role}
					onChange={(e) => setRole(e.target.value)}
				/>
				<input
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
				<button type="submit" className="btn" disabled={!name || add.isPending}>
					Add
				</button>
			</form>
		</div>
	);
}

function AddTouchpoint({
	companyId,
	onAdded,
}: {
	companyId: string;
	onAdded: () => void;
}) {
	const [channel, setChannel] = useState("email");
	const [subject, setSubject] = useState("");
	const [sentAt, setSentAt] = useState(() =>
		new Date().toISOString().slice(0, 16),
	);
	const add = useMutation({
		mutationFn: () =>
			api.addTouchpoint(companyId, {
				channel,
				subject: subject || null,
				sentAt: localInputToISO(sentAt),
			}),
		onSuccess: () => {
			setSubject("");
			onAdded();
		},
	});
	return (
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				add.mutate();
			}}
		>
			<select value={channel} onChange={(e) => setChannel(e.target.value)}>
				<option value="email">Email</option>
				<option value="linkedin">LinkedIn</option>
				<option value="call">Call</option>
				<option value="other">Other</option>
			</select>
			<input
				placeholder="Subject"
				value={subject}
				onChange={(e) => setSubject(e.target.value)}
			/>
			<input
				type="datetime-local"
				value={sentAt}
				onChange={(e) => setSentAt(e.target.value)}
			/>
			<button type="submit" className="btn" disabled={add.isPending}>
				Log touchpoint
			</button>
		</form>
	);
}

function Timeline({
	touchpoints,
	onChange,
}: {
	touchpoints: Touchpoint[];
	onChange: () => void;
}) {
	return (
		<ul className="timeline">
			{touchpoints.map((tp) => (
				<TimelineItem key={tp.id} tp={tp} onChange={onChange} />
			))}
			{touchpoints.length === 0 && (
				<li className="muted">No touchpoints yet.</li>
			)}
		</ul>
	);
}

function TimelineItem({
	tp,
	onChange,
}: {
	tp: Touchpoint;
	onChange: () => void;
}) {
	const setStatus = useMutation({
		mutationFn: (status: TouchpointStatus) => api.setStatus(tp.id, status),
		onSuccess: onChange,
	});
	const setFollowUp = useMutation({
		mutationFn: (v: string | null) => api.setFollowUp(tp.id, v),
		onSuccess: onChange,
	});

	return (
		<li className="timeline-item">
			<div className="timeline-main">
				<span className={`status status-${tp.currentStatus ?? "sent"}`}>
					{tp.currentStatus}
				</span>
				<strong>{tp.channel}</strong>
				{tp.subject && <span> · {tp.subject}</span>}
				<span className="muted"> · {fmtDateTime(tp.sentAt)}</span>
			</div>
			<div className="timeline-controls">
				{STATUSES.map((s) => (
					<button
						key={s}
						type="button"
						className="btn btn-ghost btn-sm"
						onClick={() => setStatus.mutate(s)}
						disabled={setStatus.isPending}
					>
						{s}
					</button>
				))}
				<label className="followup">
					Follow-up
					<input
						type="datetime-local"
						defaultValue={
							tp.nextFollowUpAt ? tp.nextFollowUpAt.slice(0, 16) : ""
						}
						onChange={(e) =>
							setFollowUp.mutate(
								e.target.value ? localInputToISO(e.target.value) : null,
							)
						}
					/>
					{isOverdue(tp.nextFollowUpAt) && (
						<span className="flag" title="Overdue" />
					)}
				</label>
			</div>
		</li>
	);
}
