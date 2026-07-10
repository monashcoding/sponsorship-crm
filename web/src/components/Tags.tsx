import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api.js";
import type { Tag } from "../lib/types.js";

/** A single colored tag chip; shows a remove (×) button when onRemove is given. */
export function TagChip({
	tag,
	onRemove,
}: {
	tag: Tag;
	onRemove?: () => void;
}) {
	return (
		<span className="tag-chip">
			<span className="tag-dot" style={{ background: tag.color }} />
			{tag.name}
			{onRemove && (
				<button
					type="button"
					className="tag-x"
					title="Remove tag"
					onClick={onRemove}
				>
					×
				</button>
			)}
		</span>
	);
}

/**
 * Pipeline filter bar: one clickable chip per tag (with usage count). Clicking a tag
 * sets it as the active filter; clicking the active one (or "All") clears it.
 */
export function TagFilterBar({
	active,
	onChange,
}: {
	active: string | null;
	onChange: (tagId: string | null) => void;
}) {
	const tags = useQuery({ queryKey: ["tags"], queryFn: api.tags });
	if (!tags.data || tags.data.length === 0) return null;

	return (
		<div className="tag-filter">
			<button
				type="button"
				className={`tag-filter-chip ${active === null ? "active" : ""}`}
				onClick={() => onChange(null)}
			>
				All
			</button>
			{tags.data.map((t) => (
				<button
					key={t.id}
					type="button"
					className={`tag-filter-chip ${active === t.id ? "active" : ""}`}
					onClick={() => onChange(active === t.id ? null : t.id)}
				>
					<span className="tag-dot" style={{ background: t.color }} />
					{t.name}
					<span className="muted"> {t.count}</span>
				</button>
			))}
		</div>
	);
}

/**
 * The tag editor on a company: current tags as removable chips plus an input that
 * adds an existing tag (autocompleted) or creates a new one by name.
 */
export function CompanyTagsEditor({
	companyId,
	tags,
	onChange,
}: {
	companyId: string;
	tags: Tag[];
	onChange: () => void;
}) {
	const qc = useQueryClient();
	const [name, setName] = useState("");
	const suggestions = useQuery({ queryKey: ["tags"], queryFn: api.tags });

	const invalidate = () => {
		onChange();
		void qc.invalidateQueries({ queryKey: ["tags"] });
	};

	const add = useMutation({
		mutationFn: (n: string) => api.addCompanyTag(companyId, { name: n }),
		onSuccess: () => {
			setName("");
			invalidate();
		},
	});
	const remove = useMutation({
		mutationFn: (tagId: string) => api.removeCompanyTag(companyId, tagId),
		onSuccess: invalidate,
	});

	const current = new Set(tags.map((t) => t.id));

	return (
		<div className="tag-editor">
			<div className="tag-list">
				{tags.map((t) => (
					<TagChip key={t.id} tag={t} onRemove={() => remove.mutate(t.id)} />
				))}
				{tags.length === 0 && <span className="muted">No tags yet.</span>}
			</div>
			<form
				className="inline-form"
				onSubmit={(e) => {
					e.preventDefault();
					const n = name.trim();
					if (n) add.mutate(n);
				}}
			>
				<input
					list="tag-suggestions"
					placeholder="Add a tag (e.g. Sponsors 2026)"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<datalist id="tag-suggestions">
					{suggestions.data
						?.filter((t) => !current.has(t.id))
						.map((t) => (
							<option key={t.id} value={t.name} />
						))}
				</datalist>
				<button
					type="submit"
					className="btn"
					disabled={!name.trim() || add.isPending}
				>
					Add
				</button>
			</form>
		</div>
	);
}
