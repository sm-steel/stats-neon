import { describe, expect, it, vi } from "vitest";
import {
	contributionsQuery,
	fetchContributions,
	fetchExtras,
	fetchProfile,
} from "../src/github.ts";

const ok = (data: unknown) => new Response(JSON.stringify({ data }));
const user = (
	nodes: unknown[],
	hasNextPage: boolean,
	endCursor: string | null = null,
) => ({
	user: {
		login: "Some-User",
		createdAt: "2025-06-23T10:20:54Z",
		followers: { totalCount: 1 },
		repositoriesContributedTo: { totalCount: 48 },
		repositories: {
			totalCount: 150,
			pageInfo: { hasNextPage, endCursor },
			nodes,
		},
	},
});
const node = {
	isFork: false,
	stargazerCount: 1,
	releases: { totalCount: 0 },
	languages: { edges: [] },
};

describe("fetchProfile", () => {
	it("merges repo pages and sends the login as given (Review Focus 4, 5)", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(ok(user([node, node], true, "c1")))
			.mockResolvedValueOnce(ok(user([node], false)));
		const p = await fetchProfile("Some-User", "tok", fetchFn);
		expect(p).toMatchObject({
			login: "Some-User",
			repoCount: 150,
			contributedTo: 48,
			followers: 1,
		});
		expect(p.repos).toHaveLength(3);
		const body = (i: number) =>
			JSON.parse(String((fetchFn.mock.calls[i]?.[1] as RequestInit).body));
		expect(body(0).variables).toEqual({ login: "Some-User", after: null });
		expect(body(1).variables).toEqual({ login: "Some-User", after: "c1" });
		expect(
			(
				(fetchFn.mock.calls[0]?.[1] as RequestInit).headers as Record<
					string,
					string
				>
			).Authorization,
		).toBe("bearer tok");
	});
	it("stops at the page cap", async () => {
		const fetchFn = vi.fn(async () => ok(user([node], true, "c")));
		const p = await fetchProfile("u", "t", fetchFn, 3);
		expect(fetchFn).toHaveBeenCalledTimes(3);
		expect(p.repos).toHaveLength(3);
	});
	it("reports missing users, GraphQL errors and HTTP failures", async () => {
		await expect(
			fetchProfile(
				"ghost",
				"t",
				vi.fn(async () => ok({ user: null })),
			),
		).rejects.toThrow(/"ghost" not found/);
		await expect(
			fetchProfile(
				"u",
				"t",
				vi.fn(
					async () =>
						new Response(
							JSON.stringify({ errors: [{ message: "Bad credentials" }] }),
						),
				),
			),
		).rejects.toThrow(/Bad credentials/);
		await expect(
			fetchProfile(
				"u",
				"t",
				vi.fn(async () => new Response("no", { status: 502 })),
			),
		).rejects.toThrow(/502/);
	});
});

describe("contributions", () => {
	it("builds one alias per year since joining", () => {
		const q = contributionsQuery(
			"2025-06-23T10:20:54Z",
			new Date("2026-10-10T00:00:00Z"),
		);
		expect(q).toContain(
			'y2025: contributionsCollection(from: "2025-06-23T10:20:54Z", to: "2025-12-31T23:59:59Z")',
		);
		expect(q).toContain(
			'y2026: contributionsCollection(from: "2026-01-01T00:00:00Z", to: "2026-12-31T23:59:59Z")',
		);
		expect(q).not.toContain("y2027");
	});
	it("refuses a malformed createdAt instead of building a query from it", () => {
		expect(() => contributionsQuery('2025") { evil', new Date())).toThrow(
			/createdAt/,
		);
	});
	it("sums totals and flattens days across years", async () => {
		const cal = (total: number, dates: string[]) => ({
			contributionCalendar: {
				totalContributions: total,
				weeks: [
					{
						contributionDays: dates.map((date) => ({
							date,
							contributionCount: 1,
						})),
					},
				],
			},
		});
		const fetchFn = vi.fn(async () =>
			ok({
				user: { y2025: cal(2, ["2025-12-31"]), y2026: cal(3, ["2026-01-01"]) },
			}),
		);
		const r = await fetchContributions(
			"u",
			"2025-06-23T10:20:54Z",
			"t",
			new Date("2026-10-10T00:00:00Z"),
			fetchFn,
		);
		expect(r.total).toBe(5);
		expect(r.days.map((d) => d.date)).toEqual(["2025-12-31", "2026-01-01"]);
	});
});

describe("fetchExtras (best effort)", () => {
	const extras = {
		user: {
			sponsorshipsAsMaintainer: { totalCount: 2 },
			packages: { totalCount: 1 },
			repositories: { totalDiskUsage: 51602 },
		},
	};
	it("returns sponsors, packages and disk usage", async () => {
		const r = await fetchExtras(
			"u",
			"t",
			vi.fn(async () => ok(extras)),
		);
		expect(r).toEqual({ sponsors: 2, packages: 1, diskKB: 51602 });
	});
	it("keeps what GitHub returned when some fields error", async () => {
		const partial = {
			data: { user: { ...extras.user, packages: null } },
			errors: [{ message: "Resource not accessible by integration" }],
		};
		const r = await fetchExtras(
			"u",
			"t",
			vi.fn(async () => new Response(JSON.stringify(partial))),
		);
		expect(r).toEqual({ sponsors: 2, packages: null, diskKB: 51602 });
	});
	it("never throws: HTTP or network failures give all nulls", async () => {
		const empty = { sponsors: null, packages: null, diskKB: null };
		expect(
			await fetchExtras(
				"u",
				"t",
				vi.fn(async () => new Response("no", { status: 403 })),
			),
		).toEqual(empty);
		expect(
			await fetchExtras(
				"u",
				"t",
				vi.fn(async () => {
					throw new Error("down");
				}),
			),
		).toEqual(empty);
	});
});
