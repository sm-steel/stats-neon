import type { Run } from "./types.ts";

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

export function fmtDay(iso: string, currentYear: number): string {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return `${MONTHS[m - 1]} ${d}${y === currentYear ? "" : `, ${y}`}`;
}

export function fmtRun(run: Run | null, currentYear: number): string {
	if (!run) return "—";
	return run.length === 1
		? fmtDay(run.start, currentYear)
		: `${fmtDay(run.start, currentYear)} – ${fmtDay(run.end, currentYear)}`;
}

export const fmtSince = (since: string | null, currentYear: number): string =>
	since ? `${fmtDay(since, currentYear)} – now` : "—";

/** "2Y", "8MO" or "29D" since `createdAt`. */
export function fmtAge(createdAt: string, now: Date): string {
	const c = new Date(createdAt);
	const months =
		(now.getUTCFullYear() - c.getUTCFullYear()) * 12 +
		(now.getUTCMonth() - c.getUTCMonth()) -
		(now.getUTCDate() < c.getUTCDate() ? 1 : 0);
	if (months >= 12) return `${Math.floor(months / 12)}Y`;
	if (months >= 1) return `${months}MO`;
	return `${Math.max(0, Math.floor((now.getTime() - c.getTime()) / 86400000))}D`;
}

export const fmtInt = (n: number): string => n.toLocaleString("en-US");
