import { describe, expect, it } from "vitest";
import { languages, repoStats } from "../src/stats.ts";
import type { Profile, Repo } from "../src/types.ts";

const repo = (langs: [string, number][], o: Partial<Repo> = {}): Repo => ({
	isFork: false,
	stargazerCount: 0,
	releases: { totalCount: 0 },
	languages: { edges: langs.map(([name, size]) => ({ size, node: { name } })) },
	...o,
});
const repos = [
	repo(
		[
			["Python", 600],
			["Lua", 100],
		],
		{ stargazerCount: 2, releases: { totalCount: 5 } },
	),
	repo([["Rust", 1000]], { isFork: true, stargazerCount: 7 }),
	repo([
		["Python", 200],
		["TypeScript", 100],
	]),
];

describe("languages", () => {
	it("sums non-fork repos, sorts by size then name, and groups the rest", () => {
		const l = languages(repos, 2);
		expect(l.top.map((x) => [x.name, x.pct])).toEqual([
			["Python", 80],
			["Lua", 10],
		]);
		expect(l.otherPct).toBeCloseTo(10);
	});
	it("has no Other when N covers every language", () => {
		expect(languages(repos, 8).otherPct).toBe(0);
	});
	it("handles no language data (Review Focus 1)", () => {
		expect(languages([], 8)).toEqual({ top: [], otherPct: 0 });
	});
});

describe("repoStats", () => {
	it("sums over owned repos (forks included) and formats age", () => {
		const p: Profile = {
			login: "u",
			createdAt: "2025-06-23T10:20:54Z",
			followers: 1,
			contributedTo: 48,
			repoCount: 37,
			repos,
		};
		expect(repoStats(p, new Date("2026-10-10T00:00:00Z"))).toEqual({
			repos: 37,
			contributedTo: 48,
			stars: 9,
			releases: 5,
			followers: 1,
			joined: "1Y",
		});
	});
});
