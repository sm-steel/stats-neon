import { describe, expect, it } from "vitest";
import { addDays, normalizeDays, streaks } from "../src/streaks.ts";
import type { Day } from "../src/types.ts";

const run = (start: string, n: number, count = 1): Day[] =>
	Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), count }));

describe("addDays", () => {
	it("crosses month and year boundaries", () => {
		expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
	});
});

describe("normalizeDays", () => {
	it("drops future days, dedupes keeping the max, and sorts", () => {
		const days = normalizeDays(
			[
				{ date: "2026-10-11", count: 5 },
				{ date: "2026-10-02", count: 1 },
				{ date: "2026-10-01", count: 0 },
				{ date: "2026-10-02", count: 3 },
			],
			"2026-10-10",
		);
		expect(days).toEqual([
			{ date: "2026-10-01", count: 0 },
			{ date: "2026-10-02", count: 3 },
		]);
	});
});

describe("streaks", () => {
	const today = "2026-10-10";
	it("finds the current run ending today and the longest overall", () => {
		const days = [
			...run("2025-12-30", 4),
			...run("2026-09-01", 2, 0),
			...run("2026-10-01", 10),
		];
		const s = streaks(days, today);
		expect(s.current).toEqual({
			start: "2026-10-01",
			end: "2026-10-10",
			length: 10,
		});
		expect(s.longest).toEqual(s.current);
		expect(s.since).toBe("2025-12-30");
	});
	it("treats a run across Dec 31 → Jan 1 as continuous (Review Focus 2)", () => {
		const s = streaks(
			[...run("2025-12-28", 4), ...run("2026-01-01", 3)],
			"2026-01-03",
		);
		expect(s.longest).toEqual({
			start: "2025-12-28",
			end: "2026-01-03",
			length: 7,
		});
	});
	it("gives a grace day when today has no contributions yet", () => {
		const s = streaks(
			[...run("2026-10-05", 5), { date: today, count: 0 }],
			today,
		);
		expect(s.current).toEqual({
			start: "2026-10-05",
			end: "2026-10-09",
			length: 5,
		});
	});
	it("resets when today and yesterday are both empty", () => {
		const s = streaks(
			[...run("2026-10-01", 3), ...run("2026-10-09", 2, 0)],
			today,
		);
		expect(s.current).toBeNull();
		expect(s.longest?.length).toBe(3);
	});
	it("prefers the most recent run on a longest-streak tie", () => {
		const s = streaks(
			[...run("2026-09-01", 3), ...run("2026-09-10", 3)],
			today,
		);
		expect(s.longest?.start).toBe("2026-09-10");
	});
	it("handles a user with no contributions (Review Focus 1)", () => {
		expect(streaks(run("2026-10-01", 10, 0), today)).toEqual({
			current: null,
			longest: null,
			since: null,
		});
		expect(streaks([], today)).toEqual({
			current: null,
			longest: null,
			since: null,
		});
	});
	it("ignores future days", () => {
		expect(streaks([{ date: "2026-10-11", count: 9 }], today).since).toBeNull();
	});
});
