import { describe, expect, it } from "vitest";
import { languages, repoStats } from "../src/stats.ts";
import type { Profile, Repo } from "../src/types.ts";

const repo = (langs: [string, number][], o: Partial<Repo> = {}): Repo => ({
	isFork: false,
	stargazerCount: 0,
	forkCount: 0,
	watchers: { totalCount: 0 },
	licenseInfo: null,
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
		{
			stargazerCount: 2,
			releases: { totalCount: 5 },
			forkCount: 1,
			watchers: { totalCount: 3 },
			licenseInfo: { spdxId: "MIT" },
		},
	),
	repo([["Rust", 1000]], {
		isFork: true,
		stargazerCount: 7,
		licenseInfo: { spdxId: "Apache-2.0" },
	}),
	repo(
		[
			["Python", 200],
			["TypeScript", 100],
		],
		{ forkCount: 2, licenseInfo: { spdxId: "MIT" } },
	),
	repo([], { licenseInfo: { spdxId: "NOASSERTION" } }),
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
		expect(languages([], 8)).toEqual({ top: [], otherPct: 0, count: 0 });
	});
});

describe("repoStats", () => {
	const p: Profile = {
		login: "u",
		createdAt: "2025-06-23T10:20:54Z",
		followers: 1,
		contributedTo: 48,
		repoCount: 37,
		repos,
		sponsors: 0,
		packages: null,
		diskKB: 51602,
	};
	it("sums over owned repos (forks included), picks the most common license and formats age", () => {
		expect(repoStats(p, new Date("2026-10-10T00:00:00Z"))).toEqual({
			repos: 37,
			contributedTo: 48,
			stars: 9,
			releases: 5,
			followers: 1,
			joined: "1Y",
			forks: 3,
			watchers: 3,
			license: "MIT",
			sponsors: 0,
			packages: null,
			diskKB: 51602,
		});
	});
	it("has no license when no repo declares a real one", () => {
		const none = repoStats(
			{
				...p,
				repos: [repo([], { licenseInfo: { spdxId: "NOASSERTION" } }), repo([])],
			},
			new Date(),
		);
		expect(none.license).toBeNull();
	});
});

describe("language count", () => {
	it("counts distinct languages in non-fork repos", () => {
		expect(languages(repos, 2).count).toBe(3);
		expect(languages([], 8).count).toBe(0);
	});
});
