import type { Day, Run } from "./types.ts";

/** ISO date `n` days after `iso` (UTC). */
export function addDays(iso: string, n: number): string {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Days up to and including `today`, one per date (max count), oldest first. */
export function normalizeDays(days: Day[], today: string): Day[] {
	const byDate = new Map<string, number>();
	for (const d of days) {
		if (d.date > today) continue;
		byDate.set(d.date, Math.max(byDate.get(d.date) ?? 0, d.count));
	}
	return [...byDate]
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

export function streaks(
	days: Day[],
	today: string,
): { current: Run | null; longest: Run | null; since: string | null } {
	const active = normalizeDays(days, today)
		.filter((d) => d.count > 0)
		.map((d) => d.date);
	const has = new Set(active);

	let longest: Run | null = null;
	let start = "";
	active.forEach((date, i) => {
		if (i === 0 || active[i - 1] !== addDays(date, -1)) start = date;
		const length =
			Math.round((Date.parse(date) - Date.parse(start)) / 86400000) + 1;
		// >= so a later run of equal length wins
		if (!longest || length >= longest.length)
			longest = { start, end: date, length };
	});

	const end = has.has(today)
		? today
		: has.has(addDays(today, -1))
			? addDays(today, -1)
			: null;
	let current: Run | null = null;
	if (end) {
		let first = end;
		while (has.has(addDays(first, -1))) first = addDays(first, -1);
		current = {
			start: first,
			end,
			length: Math.round((Date.parse(end) - Date.parse(first)) / 86400000) + 1,
		};
	}
	return { current, longest, since: active[0] ?? null };
}
