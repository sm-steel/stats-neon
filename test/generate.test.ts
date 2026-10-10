import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { collect, generate } from "../src/generate.ts";

const profile = {
	user: {
		login: "u",
		createdAt: "2026-10-01T00:00:00Z",
		followers: { totalCount: 0 },
		repositoriesContributedTo: { totalCount: 1 },
		repositories: {
			totalCount: 1,
			pageInfo: { hasNextPage: false, endCursor: null },
			nodes: [
				{
					isFork: false,
					stargazerCount: 0,
					forkCount: 0,
					watchers: { totalCount: 0 },
					licenseInfo: null,
					releases: { totalCount: 0 },
					languages: { edges: [{ size: 10, node: { name: "Go" } }] },
				},
			],
		},
	},
};
const days = Array.from({ length: 10 }, (_, i) => ({
	date: `2026-10-${String(i + 1).padStart(2, "0")}`,
	contributionCount: 1,
}));
const contributions = {
	user: {
		y2026: {
			contributionCalendar: {
				totalContributions: 10,
				weeks: [{ contributionDays: days }],
			},
		},
	},
};

describe("collect + generate", () => {
	it("collects card data and writes one SVG per output line", async () => {
		const extras = {
			sponsorshipsAsMaintainer: { totalCount: 0 },
			packages: { totalCount: 0 },
			repositories: { totalDiskUsage: 10 },
		};
		// route by query: profile, the three per-field extras, then contributions
		const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
			const q = String(JSON.parse(String(init?.body)).query);
			const data = q.includes("contributionsCollection")
				? contributions
				: /sponsorshipsAsMaintainer|packages|totalDiskUsage/.test(q)
					? { user: extras }
					: profile;
			return new Response(JSON.stringify({ data }));
		});
		const d = await collect(
			"u",
			"t",
			new Date("2026-10-10T12:00:00Z"),
			fetchFn,
		);
		expect(d).toMatchObject({
			total: 10,
			since: "2026-10-01",
			currentYear: 2026,
		});
		expect(d.current?.length).toBe(10);
		expect(d.stats).toMatchObject({ sponsors: 0, packages: 0, diskKB: 10 });
		const dir = await mkdtemp(join(tmpdir(), "stats-neon-"));
		const written = await generate(d, [
			`${dir}/a.svg?flavor=latte`,
			"",
			`${dir}/b.svg`,
		]);
		expect(written).toEqual([`${dir}/a.svg`, `${dir}/b.svg`]);
		expect(await readFile(`${dir}/a.svg`, "utf8")).toContain("SYS.STATS");
	});
	it("rejects an empty outputs list", async () => {
		await expect(generate({} as never, ["  "])).rejects.toThrow(/No outputs/);
	});
});
