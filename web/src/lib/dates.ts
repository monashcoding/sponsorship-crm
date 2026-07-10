// Everything is stored UTC (timestamptz). Always render in Melbourne; convert local
// input back to UTC ISO before sending.
const MELB = "Australia/Melbourne";

const dateTimeFmt = new Intl.DateTimeFormat("en-AU", {
	timeZone: MELB,
	day: "2-digit",
	month: "short",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("en-AU", {
	timeZone: MELB,
	day: "2-digit",
	month: "short",
	year: "numeric",
});

export function fmtDateTime(iso: string | null | undefined): string {
	if (!iso) return "—";
	return dateTimeFmt.format(new Date(iso));
}

export function fmtDate(iso: string | null | undefined): string {
	if (!iso) return "—";
	return dateFmt.format(new Date(iso));
}

/** A `datetime-local` value (local wall-clock) → UTC ISO for the API. */
export function localInputToISO(value: string): string {
	return new Date(value).toISOString();
}

export function isOverdue(iso: string | null | undefined): boolean {
	return !!iso && new Date(iso).getTime() <= Date.now();
}
