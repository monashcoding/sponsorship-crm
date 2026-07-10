import { apiJson } from "./apiFetch.js";
import type {
	CompanyDetail,
	CompanyRow,
	Contact,
	DupeCandidate,
	FollowUp,
	Me,
	Member,
	Stage,
	TagWithCount,
	Touchpoint,
	TouchpointStatus,
} from "./types.js";

export const api = {
	me: () => apiJson<Me>("/api/me"),
	members: () => apiJson<Member[]>("/api/members"),

	companies: (
		params: { stage?: string; owner?: string; q?: string; tag?: string } = {},
	) => {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
		const s = qs.toString();
		return apiJson<CompanyRow[]>(`/api/companies${s ? `?${s}` : ""}`);
	},

	createCompany: (body: Record<string, unknown>) =>
		apiJson<CompanyDetail["company"]>("/api/companies", {
			method: "POST",
			body: JSON.stringify(body),
		}),

	company: (id: string) => apiJson<CompanyDetail>(`/api/companies/${id}`),

	patchCompany: (id: string, body: Record<string, unknown>) =>
		apiJson<CompanyDetail["company"]>(`/api/companies/${id}`, {
			method: "PATCH",
			body: JSON.stringify(body),
		}),

	moveStage: (id: string, stage: Stage) =>
		apiJson<CompanyDetail["company"]>(`/api/companies/${id}/stage`, {
			method: "POST",
			body: JSON.stringify({ stage }),
		}),

	addContact: (companyId: string, body: Record<string, unknown>) =>
		apiJson<Contact>(`/api/companies/${companyId}/contacts`, {
			method: "POST",
			body: JSON.stringify(body),
		}),

	patchContact: (id: string, body: Record<string, unknown>) =>
		apiJson<Contact>(`/api/contacts/${id}`, {
			method: "PATCH",
			body: JSON.stringify(body),
		}),

	deleteContact: (id: string) =>
		apiJson<null>(`/api/contacts/${id}`, { method: "DELETE" }),

	addTouchpoint: (companyId: string, body: Record<string, unknown>) =>
		apiJson<Touchpoint>(`/api/companies/${companyId}/touchpoints`, {
			method: "POST",
			body: JSON.stringify(body),
		}),

	setStatus: (touchpointId: string, status: TouchpointStatus, note?: string) =>
		apiJson<{ ok: true }>(`/api/touchpoints/${touchpointId}/status`, {
			method: "POST",
			body: JSON.stringify({ status, note }),
		}),

	setFollowUp: (touchpointId: string, nextFollowUpAt: string | null) =>
		apiJson<Touchpoint>(`/api/touchpoints/${touchpointId}/follow-up`, {
			method: "PATCH",
			body: JSON.stringify({ nextFollowUpAt }),
		}),

	pipeline: (tag?: string) =>
		apiJson<Record<Stage, CompanyRow[]>>(
			`/api/pipeline${tag ? `?tag=${tag}` : ""}`,
		),

	tags: () => apiJson<TagWithCount[]>("/api/tags"),

	deleteTag: (id: string) =>
		apiJson<null>(`/api/tags/${id}`, { method: "DELETE" }),

	addCompanyTag: (companyId: string, body: { tagId?: string; name?: string }) =>
		apiJson<{ ok: true; tagId: string }>(`/api/companies/${companyId}/tags`, {
			method: "POST",
			body: JSON.stringify(body),
		}),

	removeCompanyTag: (companyId: string, tagId: string) =>
		apiJson<null>(`/api/companies/${companyId}/tags/${tagId}`, {
			method: "DELETE",
		}),

	followUps: (overdue = false) =>
		apiJson<FollowUp[]>(`/api/follow-ups${overdue ? "?overdue=1" : ""}`),

	reassign: (from: string, to: string) =>
		apiJson<{ companiesMoved: number; touchpointsMoved: number }>(
			"/api/reassign",
			{
				method: "POST",
				body: JSON.stringify({ from, to }),
			},
		),
};

export type { DupeCandidate };
