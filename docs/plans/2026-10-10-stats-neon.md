# stats-neon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reusable GitHub Action, `sm-steel/stats-neon`, that renders one neon `// SYS.STATS` card (streaks, repo stats, languages) from GitHub's GraphQL API. It replaces lowlighter/metrics and streak-stats on the `sm-steel` profile.

**Architecture:**
- Pure modules: `streaks` (date maths), `format` (labels), `stats` (repo sums and languages), `options` (output-line parsing), `render` (neon-kit SVG).
- I/O module: `github` (GraphQL with an injectable `fetch`).
- `generate` ties them together. `action.ts` and `cli.ts` are thin entry points, bundled by esbuild into `dist/`.
- The structure mirrors `~/src/contrib-neon`: `.ts` import extensions, and Node runs the TypeScript directly for the CLI and preview.

**Tech Stack:** Node 24.21 (mise), TypeScript 7 (check only), `@sm-steel/neon-kit` ^1.1.0, esbuild, Vitest 5, Biome 2.

**Spec:** `docs/specs/2026-10-10-stats-neon-design.md`. Read it alongside this plan.

## Global Constraints

- **The repo is local only until Task 8.** Work on branch `feat/impl`, never on `main`.
- **Dependencies:** the only runtime dependency is `@sm-steel/neon-kit` ^1.1.0. `dist/` is committed, and CI checks that it's current.
- **GraphQL:** endpoint `https://api.github.com/graphql`, header `Authorization: bearer <token>`, `User-Agent: stats-neon`. Pagination is capped at 10 pages. `createdAt` must match `/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/` before it goes into a query string.
- **Days:** cut at today (UTC) and deduplicated by date, keeping the maximum count.
- **Streaks:** the current streak ends today, or yesterday as a grace day. The longest streak goes to the most recent run on a tie.
- **Labels:** dates as `Oct 1` or `Sep 12, 2025` (the year only when it isn't the current one); `—` for no streak; since as `… – now`; age as `NY` / `NMO` / `ND`; integers with en-US thousands separators.
- **Languages:** non-fork repos only, sorted by size descending then name ascending; top N (1–8, default 8) plus `Other`.
- **Colours** (rank 1–8): mauve, blue, teal, green, yellow, peach, red, pink; `Other` is `overlay0`. The hex values per flavor are in Task 2.
- **Card:**
  - `title: "Sys.Stats :: @<login>"`, `seed: "stats:<login>"`, `label: "<login>'s GitHub stats"`, text font 400+700, content width 868.
  - Tiles: 3 × ((868−20)/3) × 78. Stats line baseline 108. `// LANGUAGES` at 138. Bar at y=148, h=10, `rx=2`, clip id `st-bar`. Legend in 4 columns × 217, first baseline 178, then +20 per row.
  - Height: the last legend baseline + 6, or 116 without languages.
- **Commits:** default git author. Every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Lint rules:** never loosen Biome rules or add excludes, except the established `"!dist"` for the generated bundle, as in contrib-neon.
- **Outward-facing steps:** creating the repo, pushing, tagging and changing the profile all need the user's go-ahead at that moment.

## Review Focus

1. **A user with zero contributions or zero non-fork repos:** expect `0`/`—` tiles and no languages section, with no crash and no NaN. Tested in Tasks 3 and 6.
2. **A streak spanning Dec 31 to Jan 1, where the days come from two year aliases:** expect one continuous run. Tested in Task 3.
3. **A language name with XML specials** (e.g. `C++`, `F#`, a crafted `<x>` name): expect it escaped in the legend. Tested in Task 6.
4. **A login with uppercase letters or hyphens:** expect the API to be queried with it as given and the HUD to show it uppercased. Tested in Task 6.
5. **More than 100 repos (pagination):** expect all pages merged up to the cap, with the repo count from `totalCount`. Tested in Task 5.

---

### Task 1: Scaffold the project

**Files:** `package.json`, `mise.toml`, `tsconfig.json`, `biome.json`, `.gitignore`, `LICENSE`, `build.mjs`, `src/types.ts`

- [ ] **Step 1: Branch and write the configs**
```bash
cd ~/src/stats-neon && git switch -c feat/impl
```
- `package.json`:
```json
{
	"name": "stats-neon",
	"version": "1.0.0",
	"description": "Neon SYS.STATS card for your GitHub profile: streaks, repo stats and languages (Catppuccin)",
	"license": "MIT",
	"private": true,
	"type": "module",
	"engines": { "node": ">=22.18" },
	"scripts": {
		"test": "vitest run",
		"lint": "biome check .",
		"typecheck": "tsc --noEmit",
		"build": "node build.mjs"
	}
}
```
- `mise.toml`: copy from `~/src/contrib-neon/mise.toml`.
- `tsconfig.json`: copy from `~/src/contrib-neon/tsconfig.json`.
- `biome.json`: copy `~/src/contrib-neon/biome.json`, which has `files.includes: ["**", "!dist"]`.
- `.gitignore`: `node_modules/`, `preview/out/`.
- `LICENSE`: copy from `~/src/contrib-neon/LICENSE`.
- `build.mjs`: copy `~/src/contrib-neon/build.mjs` verbatim. It bundles `src/action.ts` and `src/cli.ts` into `dist/`.

- [ ] **Step 2: Install dependencies**
```bash
mise trust -q && mise install
mise exec -- npm i @sm-steel/neon-kit@^1.1.0
mise exec -- npm i -D typescript@^7.0.2 @types/node@^26.6.5 vitest@^5.0.3 @biomejs/biome@^2.5.15 esbuild@^0.28.2
```

- [ ] **Step 3: Write** `src/types.ts`
```ts
export interface Day {
	/** YYYY-MM-DD */
	date: string;
	count: number;
}

export interface Repo {
	isFork: boolean;
	stargazerCount: number;
	releases: { totalCount: number };
	languages: { edges: { size: number; node: { name: string } }[] };
}

export interface Profile {
	login: string;
	createdAt: string;
	followers: number;
	contributedTo: number;
	/** All owned repos, forks included. */
	repoCount: number;
	repos: Repo[];
}

/** A run of consecutive days with contributions. */
export interface Run {
	start: string;
	end: string;
	length: number;
}
```
- [ ] **Step 4:** Run `mise exec -- npx tsc --noEmit && mise exec -- npx biome check --write .` and commit ("Scaffold stats-neon").

---

### Task 2: `palette.ts` and `options.ts`

**Files:** `src/palette.ts`, `src/options.ts`, `test/options.test.ts`

**Interfaces:**
- Produces:
  - `RAMP: Record<Flavor, { colors: string[]; other: string }>`
  - `interface OutputSpec { path: string; flavor: Flavor; languages: number }`
  - `parseOutput(line: string): OutputSpec`

- [ ] **Step 1: Write the failing test** `test/options.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { parseOutput } from "../src/options.ts";
import { RAMP } from "../src/palette.ts";

describe("parseOutput", () => {
	it("defaults to mocha and 8 languages", () => {
		expect(parseOutput(" dist/s.svg ")).toEqual({ path: "dist/s.svg", flavor: "mocha", languages: 8 });
	});
	it("reads flavor and languages", () => {
		expect(parseOutput("a.svg?flavor=latte&languages=3")).toMatchObject({ flavor: "latte", languages: 3 });
	});
	it("rejects unknown flavors and out-of-range language counts", () => {
		expect(() => parseOutput("a.svg?flavor=espresso")).toThrow(/flavor/);
		expect(() => parseOutput("a.svg?languages=0")).toThrow(/languages/);
		expect(() => parseOutput("a.svg?languages=9")).toThrow(/languages/);
		expect(() => parseOutput("a.svg?languages=two")).toThrow(/languages/);
	});
});

describe("RAMP", () => {
	it("has 8 distinct colours plus Other in every flavor", () => {
		for (const r of Object.values(RAMP)) {
			expect(new Set(r.colors).size).toBe(8);
			expect(r.colors).not.toContain(r.other);
		}
		expect(RAMP.mocha.colors[0]).toBe("#cba6f7");
	});
});
```
- [ ] **Step 2:** Run `mise exec -- npx vitest run test/options.test.ts`. Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement** `src/palette.ts`
```ts
import type { Flavor } from "@sm-steel/neon-kit";

/** Catppuccin accents for language ranks 1-8: mauve, blue, teal, green, yellow, peach, red, pink; `other` is overlay0. */
export const RAMP: Record<Flavor, { colors: string[]; other: string }> = {
	latte: { colors: ["#8839ef", "#1e66f5", "#179299", "#40a02b", "#df8e1d", "#fe640b", "#d20f39", "#ea76cb"], other: "#9ca0b0" },
	frappe: { colors: ["#ca9ee6", "#8caaee", "#81c8be", "#a6d189", "#e5c890", "#ef9f76", "#e78284", "#f4b8e4"], other: "#737994" },
	macchiato: { colors: ["#c6a0f6", "#8aadf4", "#8bd5ca", "#a6da95", "#eed49f", "#f5a97f", "#ed8796", "#f5bde6"], other: "#6e738d" },
	mocha: { colors: ["#cba6f7", "#89b4fa", "#94e2d5", "#a6e3a1", "#f9e2af", "#fab387", "#f38ba8", "#f5c2e7"], other: "#6c7086" },
};
```
- **Implement** `src/options.ts`
```ts
import { type Flavor, isFlavor } from "@sm-steel/neon-kit";

export interface OutputSpec {
	path: string;
	flavor: Flavor;
	languages: number;
}

/** One `outputs` line: `path/file.svg?flavor=latte&languages=5`. */
export function parseOutput(line: string): OutputSpec {
	const [path = "", query = ""] = line.trim().split("?", 2);
	const params = new URLSearchParams(query);
	const flavor = params.get("flavor") ?? "mocha";
	if (!isFlavor(flavor)) throw new Error(`Unknown flavor "${flavor}" (expected latte, frappe, macchiato or mocha)`);
	const raw = params.get("languages") ?? "8";
	const languages = Number(raw);
	if (!Number.isInteger(languages) || languages < 1 || languages > 8)
		throw new Error(`languages must be a whole number from 1 to 8, got "${raw}"`);
	return { path, flavor, languages };
}
```
- [ ] **Step 4:** Run the tests, Biome and tsc. Expected: PASS. Commit ("Add Catppuccin language ramp and output options").

---

### Task 3: `streaks.ts`

**Files:** `src/streaks.ts`, `test/streaks.test.ts`

**Interfaces:**
- Produces:
  - `addDays(iso: string, n: number): string`
  - `normalizeDays(days: Day[], today: string): Day[]`
  - `streaks(days: Day[], today: string): { current: Run | null; longest: Run | null; since: string | null }`

- [ ] **Step 1: Write the failing test** `test/streaks.test.ts`
```ts
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
			[{ date: "2026-10-11", count: 5 }, { date: "2026-10-02", count: 1 }, { date: "2026-10-01", count: 0 }, { date: "2026-10-02", count: 3 }],
			"2026-10-10",
		);
		expect(days).toEqual([{ date: "2026-10-01", count: 0 }, { date: "2026-10-02", count: 3 }]);
	});
});

describe("streaks", () => {
	const today = "2026-10-10";
	it("finds the current run ending today and the longest overall", () => {
		const days = [...run("2025-12-30", 4), ...run("2026-09-01", 2, 0), ...run("2026-10-01", 10)];
		const s = streaks(days, today);
		expect(s.current).toEqual({ start: "2026-10-01", end: "2026-10-10", length: 10 });
		expect(s.longest).toEqual(s.current);
		expect(s.since).toBe("2025-12-30");
	});
	it("treats a run across Dec 31 → Jan 1 as continuous (Review Focus 2)", () => {
		const s = streaks([...run("2025-12-28", 4), ...run("2026-01-01", 3)], "2026-01-03");
		expect(s.longest).toEqual({ start: "2025-12-28", end: "2026-01-03", length: 7 });
	});
	it("gives a grace day when today has no contributions yet", () => {
		const s = streaks([...run("2026-10-05", 5), { date: today, count: 0 }], today);
		expect(s.current).toEqual({ start: "2026-10-05", end: "2026-10-09", length: 5 });
	});
	it("resets when today and yesterday are both empty", () => {
		const s = streaks([...run("2026-10-01", 3), ...run("2026-10-09", 2, 0)], today);
		expect(s.current).toBeNull();
		expect(s.longest?.length).toBe(3);
	});
	it("prefers the most recent run on a longest-streak tie", () => {
		const s = streaks([...run("2026-09-01", 3), ...run("2026-09-10", 3)], today);
		expect(s.longest?.start).toBe("2026-09-10");
	});
	it("handles a user with no contributions (Review Focus 1)", () => {
		expect(streaks(run("2026-10-01", 10, 0), today)).toEqual({ current: null, longest: null, since: null });
		expect(streaks([], today)).toEqual({ current: null, longest: null, since: null });
	});
	it("ignores future days", () => {
		expect(streaks([{ date: "2026-10-11", count: 9 }], today).since).toBeNull();
	});
});
```
- [ ] **Step 2:** Run it. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/streaks.ts`
```ts
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
	return [...byDate].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

export function streaks(days: Day[], today: string): { current: Run | null; longest: Run | null; since: string | null } {
	const active = normalizeDays(days, today).filter((d) => d.count > 0).map((d) => d.date);
	const has = new Set(active);

	let longest: Run | null = null;
	let start = "";
	active.forEach((date, i) => {
		if (i === 0 || active[i - 1] !== addDays(date, -1)) start = date;
		const length = Math.round((Date.parse(date) - Date.parse(start)) / 86400000) + 1;
		// >= so a later run of equal length wins
		if (!longest || length >= longest.length) longest = { start, end: date, length };
	});

	const end = has.has(today) ? today : has.has(addDays(today, -1)) ? addDays(today, -1) : null;
	let current: Run | null = null;
	if (end) {
		let first = end;
		while (has.has(addDays(first, -1))) first = addDays(first, -1);
		current = { start: first, end, length: Math.round((Date.parse(end) - Date.parse(first)) / 86400000) + 1 };
	}
	return { current, longest, since: active[0] ?? null };
}
```
- [ ] **Step 4:** Run the tests, Biome and tsc. Expected: PASS. Commit ("Compute contribution streaks").

---

### Task 4: `format.ts` and `stats.ts`

**Files:** `src/format.ts`, `src/stats.ts`, `test/format.test.ts`, `test/stats.test.ts`

**Interfaces:**
- Produces:
  - `fmtDay(iso: string, currentYear: number): string`
  - `fmtRun(run: Run | null, currentYear: number): string`
  - `fmtSince(since: string | null, currentYear: number): string`
  - `fmtAge(createdAt: string, now: Date): string`
  - `fmtInt(n: number): string`
  - `interface Lang { name: string; size: number; pct: number }`
  - `languages(repos: Repo[], n: number): { top: Lang[]; otherPct: number }`
  - `interface RepoStats { repos: number; contributedTo: number; stars: number; releases: number; followers: number; joined: string }`
  - `repoStats(p: Profile, now: Date): RepoStats`

- [ ] **Step 1: Write the failing tests**

`test/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fmtAge, fmtDay, fmtInt, fmtRun, fmtSince } from "../src/format.ts";

describe("format", () => {
	it("shows the year only outside the current year", () => {
		expect(fmtDay("2026-10-01", 2026)).toBe("Oct 1");
		expect(fmtDay("2025-09-12", 2026)).toBe("Sep 12, 2025");
	});
	it("formats runs, single days and no streak", () => {
		expect(fmtRun({ start: "2026-10-01", end: "2026-10-10", length: 10 }, 2026)).toBe("Oct 1 – Oct 10");
		expect(fmtRun({ start: "2026-10-10", end: "2026-10-10", length: 1 }, 2026)).toBe("Oct 10");
		expect(fmtRun({ start: "2025-12-30", end: "2026-01-02", length: 4 }, 2026)).toBe("Dec 30, 2025 – Jan 2");
		expect(fmtRun(null, 2026)).toBe("—");
	});
	it("formats since and integers", () => {
		expect(fmtSince("2025-06-23", 2026)).toBe("Jun 23, 2025 – now");
		expect(fmtSince(null, 2026)).toBe("—");
		expect(fmtInt(3023)).toBe("3,023");
	});
	it("formats account age at each boundary", () => {
		const now = new Date("2026-10-10T12:00:00Z");
		expect(fmtAge("2025-06-23T10:20:54Z", now)).toBe("1Y");
		expect(fmtAge("2024-10-10T00:00:00Z", now)).toBe("2Y");
		expect(fmtAge("2026-02-01T00:00:00Z", now)).toBe("8MO");
		expect(fmtAge("2026-09-11T00:00:00Z", now)).toBe("29D");
		expect(fmtAge("2026-10-10T00:00:00Z", now)).toBe("0D");
	});
});
```

`test/stats.test.ts`:
```ts
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
	repo([["Python", 600], ["Lua", 100]], { stargazerCount: 2, releases: { totalCount: 5 } }),
	repo([["Rust", 1000]], { isFork: true, stargazerCount: 7 }),
	repo([["Python", 200], ["TypeScript", 100]]),
];

describe("languages", () => {
	it("sums non-fork repos, sorts by size then name, and groups the rest", () => {
		const l = languages(repos, 2);
		expect(l.top.map((x) => [x.name, x.pct])).toEqual([["Python", 80], ["Lua", 10]]);
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
		const p: Profile = { login: "u", createdAt: "2025-06-23T10:20:54Z", followers: 1, contributedTo: 48, repoCount: 37, repos };
		expect(repoStats(p, new Date("2026-10-10T00:00:00Z"))).toEqual({ repos: 37, contributedTo: 48, stars: 9, releases: 5, followers: 1, joined: "1Y" });
	});
});
```
- [ ] **Step 2:** Run them. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** `src/format.ts`
```ts
import type { Run } from "./types.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDay(iso: string, currentYear: number): string {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return `${MONTHS[m - 1]} ${d}${y === currentYear ? "" : `, ${y}`}`;
}

export function fmtRun(run: Run | null, currentYear: number): string {
	if (!run) return "—";
	return run.length === 1 ? fmtDay(run.start, currentYear) : `${fmtDay(run.start, currentYear)} – ${fmtDay(run.end, currentYear)}`;
}

export const fmtSince = (since: string | null, currentYear: number): string =>
	since ? `${fmtDay(since, currentYear)} – now` : "—";

/** "2Y", "8MO" or "29D" since `createdAt`. */
export function fmtAge(createdAt: string, now: Date): string {
	const c = new Date(createdAt);
	const months =
		(now.getUTCFullYear() - c.getUTCFullYear()) * 12 + (now.getUTCMonth() - c.getUTCMonth()) - (now.getUTCDate() < c.getUTCDate() ? 1 : 0);
	if (months >= 12) return `${Math.floor(months / 12)}Y`;
	if (months >= 1) return `${months}MO`;
	return `${Math.max(0, Math.floor((now.getTime() - c.getTime()) / 86400000))}D`;
}

export const fmtInt = (n: number): string => n.toLocaleString("en-US");
```
- **Implement** `src/stats.ts`
```ts
import { fmtAge } from "./format.ts";
import type { Profile, Repo } from "./types.ts";

export interface Lang {
	name: string;
	size: number;
	pct: number;
}

/** Top `n` languages by code size over non-fork repos, plus the percentage of the rest. */
export function languages(repos: Repo[], n: number): { top: Lang[]; otherPct: number } {
	const sizes = new Map<string, number>();
	for (const r of repos) {
		if (r.isFork) continue;
		for (const e of r.languages.edges) sizes.set(e.node.name, (sizes.get(e.node.name) ?? 0) + e.size);
	}
	const total = [...sizes.values()].reduce((a, b) => a + b, 0);
	if (total === 0) return { top: [], otherPct: 0 };
	const all = [...sizes]
		.map(([name, size]) => ({ name, size, pct: (100 * size) / total }))
		.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
	const top = all.slice(0, n);
	return { top, otherPct: all.slice(n).reduce((s, l) => s + l.pct, 0) };
}

export interface RepoStats {
	repos: number;
	contributedTo: number;
	stars: number;
	releases: number;
	followers: number;
	joined: string;
}

export function repoStats(p: Profile, now: Date): RepoStats {
	return {
		repos: p.repoCount,
		contributedTo: p.contributedTo,
		stars: p.repos.reduce((s, r) => s + r.stargazerCount, 0),
		releases: p.repos.reduce((s, r) => s + r.releases.totalCount, 0),
		followers: p.followers,
		joined: fmtAge(p.createdAt, now),
	};
}
```
- [ ] **Step 4:** Run the tests, Biome and tsc. Expected: PASS. Commit ("Format labels and aggregate repo stats and languages").

---

### Task 5: `github.ts`

**Files:** `src/github.ts`, `test/github.test.ts`

**Interfaces:**
- Produces:
  - `PROFILE_QUERY: string`
  - `fetchProfile(login: string, token: string, fetchFn?: typeof fetch, maxPages?: number): Promise<Profile>`
  - `contributionsQuery(createdAt: string, now: Date): string`
  - `fetchContributions(login: string, createdAt: string, token: string, now?: Date, fetchFn?: typeof fetch): Promise<{ total: number; days: Day[] }>`

- [ ] **Step 1: Write the failing test** `test/github.test.ts`
```ts
import { describe, expect, it, vi } from "vitest";
import { contributionsQuery, fetchContributions, fetchProfile } from "../src/github.ts";

const ok = (data: unknown) => new Response(JSON.stringify({ data }));
const user = (nodes: unknown[], hasNextPage: boolean, endCursor: string | null = null) => ({
	user: {
		login: "Some-User",
		createdAt: "2025-06-23T10:20:54Z",
		followers: { totalCount: 1 },
		repositoriesContributedTo: { totalCount: 48 },
		repositories: { totalCount: 150, pageInfo: { hasNextPage, endCursor }, nodes },
	},
});
const node = { isFork: false, stargazerCount: 1, releases: { totalCount: 0 }, languages: { edges: [] } };

describe("fetchProfile", () => {
	it("merges repo pages and sends the login as given (Review Focus 4, 5)", async () => {
		const fetchFn = vi.fn().mockResolvedValueOnce(ok(user([node, node], true, "c1"))).mockResolvedValueOnce(ok(user([node], false)));
		const p = await fetchProfile("Some-User", "tok", fetchFn);
		expect(p).toMatchObject({ login: "Some-User", repoCount: 150, contributedTo: 48, followers: 1 });
		expect(p.repos).toHaveLength(3);
		const body = (i: number) => JSON.parse(String((fetchFn.mock.calls[i]?.[1] as RequestInit).body));
		expect(body(0).variables).toEqual({ login: "Some-User", after: null });
		expect(body(1).variables).toEqual({ login: "Some-User", after: "c1" });
		expect(((fetchFn.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>).Authorization).toBe("bearer tok");
	});
	it("stops at the page cap", async () => {
		const fetchFn = vi.fn(async () => ok(user([node], true, "c")));
		const p = await fetchProfile("u", "t", fetchFn, 3);
		expect(fetchFn).toHaveBeenCalledTimes(3);
		expect(p.repos).toHaveLength(3);
	});
	it("reports missing users, GraphQL errors and HTTP failures", async () => {
		await expect(fetchProfile("ghost", "t", vi.fn(async () => ok({ user: null })))).rejects.toThrow(/"ghost" not found/);
		await expect(fetchProfile("u", "t", vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Bad credentials" }] }))))).rejects.toThrow(/Bad credentials/);
		await expect(fetchProfile("u", "t", vi.fn(async () => new Response("no", { status: 502 })))).rejects.toThrow(/502/);
	});
});

describe("contributions", () => {
	it("builds one alias per year since joining", () => {
		const q = contributionsQuery("2025-06-23T10:20:54Z", new Date("2026-10-10T00:00:00Z"));
		expect(q).toContain('y2025: contributionsCollection(from: "2025-06-23T10:20:54Z", to: "2025-12-31T23:59:59Z")');
		expect(q).toContain('y2026: contributionsCollection(from: "2026-01-01T00:00:00Z", to: "2026-12-31T23:59:59Z")');
		expect(q).not.toContain("y2027");
	});
	it("refuses a malformed createdAt instead of building a query from it", () => {
		expect(() => contributionsQuery('2025") { evil', new Date())).toThrow(/createdAt/);
	});
	it("sums totals and flattens days across years", async () => {
		const cal = (total: number, dates: string[]) => ({
			contributionCalendar: { totalContributions: total, weeks: [{ contributionDays: dates.map((date) => ({ date, contributionCount: 1 })) }] },
		});
		const fetchFn = vi.fn(async () => ok({ user: { y2025: cal(2, ["2025-12-31"]), y2026: cal(3, ["2026-01-01"]) } }));
		const r = await fetchContributions("u", "2025-06-23T10:20:54Z", "t", new Date("2026-10-10T00:00:00Z"), fetchFn);
		expect(r.total).toBe(5);
		expect(r.days.map((d) => d.date)).toEqual(["2025-12-31", "2026-01-01"]);
	});
});
```
- [ ] **Step 2:** Run it. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/github.ts`
```ts
import type { Day, Profile, Repo } from "./types.ts";

const ENDPOINT = "https://api.github.com/graphql";

async function gql<T>(query: string, variables: Record<string, unknown>, token: string, fetchFn: typeof fetch): Promise<T> {
	const res = await fetchFn(ENDPOINT, {
		method: "POST",
		headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "stats-neon" },
		body: JSON.stringify({ query, variables }),
	});
	if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
	const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
	if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
	if (!json.data) throw new Error("GitHub API returned no data");
	return json.data;
}

export const PROFILE_QUERY = `query($login: String!, $after: String) {
  user(login: $login) {
    login createdAt
    followers { totalCount }
    repositoriesContributedTo(includeUserRepositories: true) { totalCount }
    repositories(ownerAffiliations: OWNER, first: 100, after: $after) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { isFork stargazerCount releases { totalCount } languages(first: 20) { edges { size node { name } } } }
    }
  }
}`;

interface ProfileData {
	user: {
		login: string;
		createdAt: string;
		followers: { totalCount: number };
		repositoriesContributedTo: { totalCount: number };
		repositories: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Repo[] };
	} | null;
}

export async function fetchProfile(login: string, token: string, fetchFn: typeof fetch = fetch, maxPages = 10): Promise<Profile> {
	const repos: Repo[] = [];
	let after: string | null = null;
	let head: NonNullable<ProfileData["user"]> | undefined;
	for (let page = 0; page < maxPages; page++) {
		const { user }: ProfileData = await gql<ProfileData>(PROFILE_QUERY, { login, after }, token, fetchFn);
		if (!user) throw new Error(`GitHub user "${login}" not found`);
		head ??= user;
		repos.push(...user.repositories.nodes);
		if (!user.repositories.pageInfo.hasNextPage) break;
		after = user.repositories.pageInfo.endCursor;
	}
	if (!head) throw new Error(`GitHub user "${login}" not found`);
	return {
		login: head.login,
		createdAt: head.createdAt,
		followers: head.followers.totalCount,
		contributedTo: head.repositoriesContributedTo.totalCount,
		repoCount: head.repositories.totalCount,
		repos,
	};
}

/** One `yYYYY` alias per calendar year since joining (each range ≤ 1 year, as the API requires). */
export function contributionsQuery(createdAt: string, now: Date): string {
	if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(createdAt)) throw new Error(`Unexpected createdAt "${createdAt}"`);
	const first = Number(createdAt.slice(0, 4));
	const parts: string[] = [];
	for (let y = first; y <= now.getUTCFullYear(); y++) {
		const from = y === first ? createdAt : `${y}-01-01T00:00:00Z`;
		parts.push(
			`y${y}: contributionsCollection(from: "${from}", to: "${y}-12-31T23:59:59Z") { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }`,
		);
	}
	return `query($login: String!) { user(login: $login) { ${parts.join(" ")} } }`;
}

interface Calendar {
	contributionCalendar: { totalContributions: number; weeks: { contributionDays: { date: string; contributionCount: number }[] }[] };
}

export async function fetchContributions(
	login: string,
	createdAt: string,
	token: string,
	now: Date = new Date(),
	fetchFn: typeof fetch = fetch,
): Promise<{ total: number; days: Day[] }> {
	const { user } = await gql<{ user: Record<string, Calendar> | null }>(contributionsQuery(createdAt, now), { login }, token, fetchFn);
	if (!user) throw new Error(`GitHub user "${login}" not found`);
	let total = 0;
	const days: Day[] = [];
	for (const year of Object.values(user)) {
		total += year.contributionCalendar.totalContributions;
		for (const w of year.contributionCalendar.weeks)
			for (const d of w.contributionDays) days.push({ date: d.date, count: d.contributionCount });
	}
	return { total, days };
}
```
- [ ] **Step 4:** Run the tests, Biome and tsc. Expected: PASS. Commit ("Fetch profile, repos and contribution calendars via GraphQL").

---

### Task 6: `render.ts`

**Files:** `src/render.ts`, `test/render.test.ts`

**Interfaces:**
- Consumes: `fmtDay`, `fmtRun`, `fmtSince`, `fmtInt` (Task 4); `Lang`, `RepoStats` (Task 4); `Run` (Task 1); `RAMP` (Task 2); `OutputSpec` (Task 2).
- Produces:
  - `interface CardData { login: string; total: number; since: string | null; current: Run | null; longest: Run | null; stats: RepoStats; langs: { top: Lang[]; otherPct: number }; currentYear: number }`
  - `LAYOUT`
  - `renderStats(d: CardData, o: Pick<OutputSpec, "flavor" | "languages">): string`

  The renderer applies the top-N cut itself, so `d.langs` must be computed with N = 8.

- [ ] **Step 1: Write the failing test** `test/render.test.ts`
```ts
import { FLAVORS } from "@sm-steel/neon-kit";
import { describe, expect, it } from "vitest";
import { RAMP } from "../src/palette.ts";
import { type CardData, LAYOUT, renderStats } from "../src/render.ts";

const lang = (name: string, pct: number) => ({ name, size: pct, pct });
const data = (o: Partial<CardData> = {}): CardData => ({
	login: "sm-steel",
	total: 3023,
	since: "2025-06-23",
	current: { start: "2026-10-01", end: "2026-10-10", length: 10 },
	longest: { start: "2026-09-12", end: "2026-09-25", length: 14 },
	stats: { repos: 37, contributedTo: 48, stars: 2, releases: 29, followers: 1, joined: "1Y" },
	langs: { top: ["Python", "Lua", "TypeScript", "HTML", "Shell", "Jinja", "Rust", "JavaScript"].map((n, i) => lang(n, [60, 12, 8, 4, 2, 1, 1, 0.6][i] ?? 0)), otherPct: 11.4 },
	currentYear: 2026,
	...o,
});
const mocha = { flavor: "mocha" as const, languages: 8 };
const h = (svg: string) => Number(svg.match(/height="([\d.]+)"/)?.[1]);

describe("renderStats", () => {
	it("shows the three streak tiles with values and ranges", () => {
		const svg = renderStats(data(), mocha);
		for (const s of [">3,023<", ">10<", ">14<", "Total Contributions", "Current Streak", "Longest Streak", "Jun 23, 2025 – now", "Oct 1 – Oct 10", "Sep 12 – Sep 25"])
			expect(svg).toContain(s);
		expect(svg).toContain("SYS.STATS :: @SM-STEEL"); // Review Focus 4
	});
	it("prints the stats line", () => {
		const svg = renderStats(data(), mocha);
		for (const s of ["REPOS", ">37<", "CONTRIBUTED TO", ">48<", "STARS", "RELEASES", ">29<", "FOLLOWERS", "JOINED", ">1Y<"]) expect(svg).toContain(s);
	});
	it("fills the bar exactly and colours by rank, with Other last", () => {
		const svg = renderStats(data(), mocha);
		const segs = [...svg.matchAll(/<rect class="st-seg" x="([\d.]+)" y="148" width="([\d.]+)" height="10" fill="(#[0-9a-f]+)"/g)];
		expect(segs).toHaveLength(9);
		const last = segs.at(-1);
		expect(Number(last?.[1]) + Number(last?.[2])).toBeCloseTo(LAYOUT.width, 3);
		expect(segs[0]?.[3]).toBe(RAMP.mocha.colors[0]);
		expect(last?.[3]).toBe(RAMP.mocha.other);
		expect(svg).toContain("Other");
	});
	it("lays out the legend in rows of 4 and grows the card", () => {
		const one = h(renderStats(data({ langs: { top: [lang("Python", 100)], otherPct: 0 } }), mocha));
		const five = h(renderStats(data({ langs: { top: ["A", "B", "C", "D", "E"].map((n) => lang(n, 20)), otherPct: 0 } }), mocha));
		const nine = h(renderStats(data(), mocha)); // 8 + Other
		expect(five - one).toBe(20);
		expect(nine - one).toBe(40);
	});
	it("respects languages=N by folding the rest into Other", () => {
		const svg = renderStats(data(), { flavor: "mocha", languages: 3 });
		expect(svg).toContain(">Python<");
		expect(svg).not.toContain(">HTML<");
		expect(svg.match(/class="st-seg"/g)).toHaveLength(4);
	});
	it("omits the languages section with no data and handles zero streaks (Review Focus 1)", () => {
		const svg = renderStats(data({ langs: { top: [], otherPct: 0 }, total: 0, since: null, current: null, longest: null }), mocha);
		expect(svg).not.toContain("LANGUAGES");
		expect(svg).toContain(">—<");
		expect(svg).not.toContain("NaN");
	});
	it("escapes language names (Review Focus 3)", () => {
		const svg = renderStats(data({ langs: { top: [lang("C++", 50), lang("<x>&", 50)], otherPct: 0 } }), mocha);
		expect(svg).toContain("&lt;x&gt;&amp;");
		expect(svg).toContain(">C++<");
	});
	it("uses Latte colours for the light flavor", () => {
		const svg = renderStats(data(), { flavor: "latte", languages: 8 });
		expect(svg).toContain(FLAVORS.latte.background);
		expect(svg).toContain(RAMP.latte.colors[0]);
	});
});
```
- [ ] **Step 2:** Run it. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/render.ts`
```ts
import { card, esc, FLAVORS, FONT_STACK, type Palette, r3 } from "@sm-steel/neon-kit";
import { fmtInt, fmtRun, fmtSince } from "./format.ts";
import type { OutputSpec } from "./options.ts";
import { RAMP } from "./palette.ts";
import type { Lang, RepoStats } from "./stats.ts";
import type { Run } from "./types.ts";

export interface CardData {
	login: string;
	total: number;
	since: string | null;
	current: Run | null;
	longest: Run | null;
	stats: RepoStats;
	/** Languages computed with N = 8; the renderer applies the output's `languages` cut. */
	langs: { top: Lang[]; otherPct: number };
	currentYear: number;
}

export const LAYOUT = { width: 868, gap: 10, tileH: 78, statsY: 108, langY: 138, barY: 148, barH: 10, legendY: 178, rowH: 20, cols: 4 } as const;

const TILE_W = (LAYOUT.width - 2 * LAYOUT.gap) / 3;
const COL_W = LAYOUT.width / LAYOUT.cols;

function tile(i: number, value: string, label: string, range: string, p: Palette): string {
	const x = r3(i * (TILE_W + LAYOUT.gap));
	const cx = r3(x + TILE_W / 2);
	return (
		`<rect x="${x}" y="0" width="${r3(TILE_W)}" height="${LAYOUT.tileH}" rx="2" fill="none" stroke="${p.border}"/>` +
		`<text x="${cx}" y="32" text-anchor="middle" font-size="26" font-weight="700" fill="${p.accent}">${esc(value)}</text>` +
		`<text x="${cx}" y="52" text-anchor="middle" font-size="13" fill="${p.text}">${label}</text>` +
		`<text x="${cx}" y="68" text-anchor="middle" font-size="11" fill="${p.subtext}">${esc(range)}</text>`
	);
}

function statsLine(s: RepoStats, p: Palette): string {
	const items: [string, string][] = [
		["REPOS", fmtInt(s.repos)],
		["CONTRIBUTED TO", fmtInt(s.contributedTo)],
		["STARS", fmtInt(s.stars)],
		["RELEASES", fmtInt(s.releases)],
		["FOLLOWERS", fmtInt(s.followers)],
		["JOINED", s.joined],
	];
	const body = items
		.map(([k, v]) => `<tspan fill="${p.subtext}">${k} </tspan><tspan fill="${p.text}">${esc(v)}</tspan>`)
		.join(`<tspan fill="${p.accent}"> · </tspan>`);
	return `<text x="0" y="${LAYOUT.statsY}" font-size="12" letter-spacing="1">${body}</text>`;
}

function languagesSection(d: CardData, n: number, p: Palette, ramp: (typeof RAMP)["mocha"]): { svg: string; height: number } {
	const top = d.langs.top.slice(0, n);
	const otherPct = d.langs.otherPct + d.langs.top.slice(n).reduce((s, l) => s + l.pct, 0);
	if (top.length === 0) return { svg: "", height: LAYOUT.statsY + 8 };
	const entries = [
		...top.map((l, i) => ({ name: l.name, pct: l.pct, color: ramp.colors[i] as string })),
		...(otherPct > 0.05 ? [{ name: "Other", pct: otherPct, color: ramp.other }] : []),
	];
	let x = 0;
	const segs = entries
		.map((e, i) => {
			const w = i === entries.length - 1 ? LAYOUT.width - x : (LAYOUT.width * e.pct) / 100;
			const seg = `<rect class="st-seg" x="${r3(x)}" y="${LAYOUT.barY}" width="${r3(w)}" height="${LAYOUT.barH}" fill="${e.color}"/>`;
			x += w;
			return seg;
		})
		.join("");
	const legend = entries
		.map((e, i) => {
			const lx = r3((i % LAYOUT.cols) * COL_W);
			const ly = LAYOUT.legendY + Math.floor(i / LAYOUT.cols) * LAYOUT.rowH;
			return (
				`<circle cx="${r3(lx + 4)}" cy="${ly - 4}" r="4" fill="${e.color}"/>` +
				`<text x="${r3(lx + 14)}" y="${ly}" font-size="12"><tspan fill="${p.text}">${esc(e.name)}</tspan><tspan fill="${p.subtext}"> ${e.pct.toFixed(1)}%</tspan></text>`
			);
		})
		.join("");
	const rows = Math.ceil(entries.length / LAYOUT.cols);
	return {
		svg:
			`<text x="0" y="${LAYOUT.langY}" font-size="10" letter-spacing="1.2" fill="${p.text}"><tspan fill="${p.accent}">//</tspan> LANGUAGES</text>` +
			`<clipPath id="st-bar"><rect x="0" y="${LAYOUT.barY}" width="${LAYOUT.width}" height="${LAYOUT.barH}" rx="2"/></clipPath>` +
			`<g clip-path="url(#st-bar)">${segs}</g>` +
			legend,
		height: LAYOUT.legendY + (rows - 1) * LAYOUT.rowH + 6,
	};
}

export function renderStats(d: CardData, o: Pick<OutputSpec, "flavor" | "languages">): string {
	const p = FLAVORS[o.flavor];
	const langs = languagesSection(d, o.languages, p, RAMP[o.flavor]);
	const content =
		tile(0, fmtInt(d.total), "Total Contributions", fmtSince(d.since, d.currentYear), p) +
		tile(1, fmtInt(d.current?.length ?? 0), "Current Streak", fmtRun(d.current, d.currentYear), p) +
		tile(2, fmtInt(d.longest?.length ?? 0), "Longest Streak", fmtRun(d.longest, d.currentYear), p) +
		statsLine(d.stats, p) +
		langs.svg;
	return card(
		{
			width: LAYOUT.width,
			height: langs.height,
			palette: p,
			seed: `stats:${d.login}`,
			label: `${d.login}'s GitHub stats`,
			title: `Sys.Stats :: @${d.login}`,
			font: { variant: "text", weights: [400, 700] },
		},
		`<g font-family="${FONT_STACK}">${content}</g>`,
	);
}
```
- [ ] **Step 4:** Run the tests, Biome and tsc. Expected: PASS. Commit ("Render the SYS.STATS neon card").

---

### Task 7: `generate`, action, CLI, build, CI and README; then the **preview gate**

**Files:** `src/generate.ts`, `src/action.ts`, `src/cli.ts`, `action.yml`, `.github/workflows/ci.yml`, `README.md`, `test/generate.test.ts`, `dist/*` (built)

**Interfaces:**
- Produces:
  - `collect(login: string, token: string, now?: Date, fetchFn?: typeof fetch): Promise<CardData>`
  - `generate(data: CardData, outputs: string[]): Promise<string[]>`

- [ ] **Step 1: Write the failing test** `test/generate.test.ts`
```ts
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
			nodes: [{ isFork: false, stargazerCount: 0, releases: { totalCount: 0 }, languages: { edges: [{ size: 10, node: { name: "Go" } }] } }],
		},
	},
};
const days = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, contributionCount: 1 }));
const contributions = { user: { y2026: { contributionCalendar: { totalContributions: 10, weeks: [{ contributionDays: days }] } } } };

describe("collect + generate", () => {
	it("collects card data and writes one SVG per output line", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: profile })))
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: contributions })));
		const d = await collect("u", "t", new Date("2026-10-10T12:00:00Z"), fetchFn);
		expect(d).toMatchObject({ total: 10, since: "2026-10-01", currentYear: 2026 });
		expect(d.current?.length).toBe(10);
		const dir = await mkdtemp(join(tmpdir(), "stats-neon-"));
		const written = await generate(d, [`${dir}/a.svg?flavor=latte`, "", `${dir}/b.svg`]);
		expect(written).toEqual([`${dir}/a.svg`, `${dir}/b.svg`]);
		expect(await readFile(`${dir}/a.svg`, "utf8")).toContain("SYS.STATS");
	});
	it("rejects an empty outputs list", async () => {
		await expect(generate({} as never, ["  "])).rejects.toThrow(/No outputs/);
	});
});
```
- [ ] **Step 2:** Run it. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/generate.ts`
```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchContributions, fetchProfile } from "./github.ts";
import { parseOutput } from "./options.ts";
import { type CardData, renderStats } from "./render.ts";
import { languages, repoStats } from "./stats.ts";
import { streaks } from "./streaks.ts";

export async function collect(login: string, token: string, now: Date = new Date(), fetchFn: typeof fetch = fetch): Promise<CardData> {
	const profile = await fetchProfile(login, token, fetchFn);
	const { total, days } = await fetchContributions(profile.login, profile.createdAt, token, now, fetchFn);
	const s = streaks(days, now.toISOString().slice(0, 10));
	return {
		login: profile.login,
		total,
		since: s.since,
		current: s.current,
		longest: s.longest,
		stats: repoStats(profile, now),
		langs: languages(profile.repos, 8),
		currentYear: now.getUTCFullYear(),
	};
}

/** Renders `data` once per output line and writes each file. Returns written paths. */
export async function generate(data: CardData, outputs: string[]): Promise<string[]> {
	const specs = outputs.filter((l) => l.trim()).map(parseOutput);
	if (specs.length === 0) throw new Error("No outputs given");
	for (const spec of specs) {
		await mkdir(dirname(spec.path), { recursive: true });
		await writeFile(spec.path, renderStats(data, spec));
	}
	return specs.map((s) => s.path);
}
```
- `src/action.ts`:
```ts
// GitHub Action entry point. Inputs arrive as INPUT_<NAME> environment variables.
import { collect, generate } from "./generate.ts";

function input(name: string): string {
	const value = (process.env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
	if (!value) throw new Error(`Input required: ${name}`);
	return value;
}

async function main() {
	const data = await collect(input("github_user_name"), input("github_token"));
	console.log(`${data.login}: ${data.total} contributions, current streak ${data.current?.length ?? 0}, longest ${data.longest?.length ?? 0}`);
	for (const path of await generate(data, input("outputs").split("\n"))) console.log(`wrote ${path}`);
}

main().catch((err: unknown) => {
	console.log(`::error::${err instanceof Error ? err.message : err}`);
	process.exit(1);
});
```
- `src/cli.ts`:
```ts
#!/usr/bin/env node
import { parseArgs } from "node:util";
import { collect, generate } from "./generate.ts";

const USAGE = `Usage: stats-neon --user <login> --out <file.svg?flavor=mocha&languages=8> [--out ...] [--token T]
Token defaults to $GITHUB_TOKEN or $GH_TOKEN.`;

async function main() {
	const { values } = parseArgs({
		options: { user: { type: "string" }, out: { type: "string", multiple: true }, token: { type: "string" }, help: { type: "boolean", short: "h" } },
	});
	if (values.help || !values.user || !values.out?.length) {
		console.log(USAGE);
		process.exit(values.help ? 0 : 1);
	}
	const token = values.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
	if (!token) throw new Error("A GitHub token is required (--token or $GITHUB_TOKEN)");
	for (const path of await generate(await collect(values.user, token), values.out)) console.log(`wrote ${path}`);
}

main().catch((err: unknown) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
```
- `action.yml`:
```yaml
name: stats-neon
description: Neon SYS.STATS card for your GitHub profile — streaks, repo stats and languages (Catppuccin)
author: sm-steel
branding:
  icon: bar-chart-2
  color: purple

inputs:
  github_user_name:
    description: GitHub login whose stats are rendered
    required: true
  outputs:
    description: |
      One output file per line, with options as a query string, e.g.
        dist/stats.svg?flavor=latte
        dist/stats-dark.svg?flavor=mocha&languages=6
      Options: flavor (latte|frappe|macchiato|mocha), languages (1-8).
    required: true
  github_token:
    description: Token used to read the profile (default workflow token = public data)
    required: false
    default: ${{ github.token }}

runs:
  using: node24
  main: dist/action.js
```
- `.github/workflows/ci.yml`: copy `~/src/contrib-neon/.github/workflows/ci.yml` and change the self-test outputs to `out/stats-latte.svg?flavor=latte` and `out/stats-mocha.svg?flavor=mocha`, with artifact name `stats-neon`.
- `README.md`. It covers:
  - what the card shows;
  - a usage workflow modeled on contrib-neon's README: the `sm-steel/stats-neon@v1` step **in the same job as** any other step that writes to `dist/`, followed by one `crazy-max/ghaction-github-pages@v5` publish to `output`, plus a note on why a single publish matters;
  - the `<picture>` embed snippet;
  - an options table (`flavor`, `languages`);
  - the streak rules (grace day, ties, UTC days);
  - token notes (public data by default);
  - Development (`mise install && npm ci`, `npm test`, `node src/cli.ts --user <u> --out preview/out/s.svg`);
  - license: MIT.

- [ ] **Step 4: Build, test, lint, typecheck; commit**

Run: `mise exec -- npm run build && mise exec -- npx vitest run && mise exec -- npx biome check --write . && mise exec -- npx tsc --noEmit`
Expected: all PASS, and `dist/action.js` plus `dist/cli.js` exist.
Commit: "Add action, CLI, CI and README".

- [ ] **Step 5: Smoke-test the bundled action locally with real data**
```bash
T=$(gh auth token); INPUT_GITHUB_USER_NAME=sm-steel INPUT_GITHUB_TOKEN=$T INPUT_OUTPUTS=$'preview/out/stats.svg?flavor=latte\npreview/out/stats-dark.svg?flavor=mocha' mise exec -- node dist/action.js
```
Expected: it logs the totals and streaks, then `wrote …` for both files.
Then check a bad token: `INPUT_GITHUB_TOKEN=x … node dist/action.js` should exit 1 with `::error::GitHub API responded 401`.

- [ ] **Step 6: PREVIEW GATE.**
1. Write `preview/out/index.html`, which shows both SVGs at GitHub's 830px README width on #0d1117 and #fff, with the current metrics/streak images below them for comparison.
2. Serve it with `python -I -m http.server 8770 --bind 127.0.0.1` from `preview/out`.
3. Check headless frames, then the user approves.

---

### Task 8: Final review, publish and profile switch (**user-confirmed**)

- [ ] **Step 1:** Final whole-branch review by a fresh reviewer, then the fix pass.
- [ ] **Step 2:** With the user's go-ahead:
```bash
git switch main && git merge --ff-only feat/impl && git branch -d feat/impl
gh repo create sm-steel/stats-neon --public --description "Neon SYS.STATS card for your GitHub profile: streaks, repo stats, languages (Catppuccin)" --source . --push
```
Watch CI (`check` + `self-test`). Then:
```bash
git tag -a v1.0.0 -m v1.0.0 && git tag v1 && git push origin v1.0.0 v1
```
- [ ] **Step 3:** With the user's go-ahead, in `~/src/sm-steel`:
  - **`.github/workflows/contrib-neon.yml`:** add this step before the publish step:
    ```yaml
          - name: Generate stats card SVGs
            uses: sm-steel/stats-neon@v1
            with:
              github_user_name: sm-steel
              outputs: |
                dist/stats.svg?flavor=latte
                dist/stats-dark.svg?flavor=mocha
    ```
  - **`metrics.yml`:** `git rm .github/workflows/metrics.yml`.
  - **README:**
    - Replace the metrics `<img …metrics.svg…>` and the streak-stats `<img …streak-stats…>` (plus the `<br />` between them) with one `<picture>`: dark `https://raw.githubusercontent.com/sm-steel/sm-steel/output/stats-dark.svg`, light `…/output/stats.svg`, `width="100%"`, alt `GitHub stats`.
    - Keep the surrounding `<div align="center">` structure intact.
  - Commit and push. Trigger the workflow (`gh workflow run contrib-neon.yml`), wait for success, and confirm `output` has `stats.svg`, `stats-dark.svg`, `contrib-neon.svg` and `contrib-neon-dark.svg`.
  - Take headless screenshots of github.com/sm-steel in both themes.
- [ ] **Step 4:** Leave the remote `output-metrics` branch alone, but tell the user it can be deleted. Clean up the preview server and the plan workspace.
