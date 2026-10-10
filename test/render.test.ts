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
	stats: {
		repos: 37,
		contributedTo: 48,
		stars: 2,
		releases: 29,
		followers: 1,
		joined: "1Y",
		forks: 0,
		watchers: 0,
		license: "MIT",
		sponsors: 0,
		packages: 0,
		diskKB: 51602,
	},
	langs: {
		top: [
			"Python",
			"Lua",
			"TypeScript",
			"HTML",
			"Shell",
			"Jinja",
			"Rust",
			"JavaScript",
		].map((n, i) => lang(n, [60, 12, 8, 4, 2, 1, 1, 0.6][i] ?? 0)),
		otherPct: 11.4,
		count: 15,
	},
	currentYear: 2026,
	...o,
});
const mocha = { flavor: "mocha" as const, languages: 8 };
const h = (svg: string) => Number(svg.match(/height="([\d.]+)"/)?.[1]);

describe("renderStats", () => {
	it("shows the three streak tiles with values and ranges", () => {
		const svg = renderStats(data(), mocha);
		for (const s of [
			">3,023<",
			">10<",
			">14<",
			"Total Contributions",
			"Current Streak",
			"Longest Streak",
			"Jun 23, 2025 – now",
			"Oct 1 – Oct 10",
			"Sep 12 – Sep 25",
		])
			expect(svg).toContain(s);
		expect(svg).toContain("SYS.STATS :: @SM-STEEL"); // Review Focus 4
	});
	it("shows the 12-stat grid, each with an Octicon", () => {
		const svg = renderStats(data(), mocha);
		const items: [string, string][] = [
			["REPOS", "37"],
			["STARS", "2"],
			["FORKERS", "0"],
			["WATCHERS", "0"],
			["CONTRIBUTED TO", "48"],
			["RELEASES", "29"],
			["PACKAGES", "0"],
			["SPONSORS", "0"],
			["FOLLOWERS", "1"],
			["JOINED", "1Y"],
			["LICENSE", "MIT"],
			["DISK", "51.6 MB"],
		];
		for (const [label, value] of items) {
			expect(svg).toContain(`>${label}</text>`);
			expect(svg).toContain(`>${value}</text>`);
		}
		expect(svg.match(/class="st-icon"/g)).toHaveLength(12);
	});
	it("hides the decorative icons from screen readers (each has a text label)", () => {
		const svg = renderStats(data(), mocha);
		expect(svg.match(/class="st-icon" aria-hidden="true"/g)).toHaveLength(12);
	});
	it("frames each stat as a badge-like cell with its value right-aligned", () => {
		const svg = renderStats(data(), mocha);
		const cells = [
			...svg.matchAll(
				/<rect class="st-cell" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/g,
			),
		];
		expect(cells).toHaveLength(12);
		const values = [
			...svg.matchAll(
				/<text class="st-val" x="([\d.]+)"[^>]*text-anchor="end"/g,
			),
		];
		expect(values).toHaveLength(12);
		// each value ends inside its cell, 10px from the right edge
		values.forEach((v, i) => {
			const c = cells[i];
			expect(Number(v[1])).toBeCloseTo(Number(c?.[1]) + Number(c?.[3]) - 10, 3);
		});
		// the last column ends flush with the card
		const last = cells.at(-1);
		expect(Number(last?.[1]) + Number(last?.[3])).toBeCloseTo(LAYOUT.width, 3);
	});
	it("shows — for stats GitHub hid from the token", () => {
		const svg = renderStats(
			data({
				stats: {
					...data().stats,
					packages: null,
					sponsors: null,
					diskKB: null,
					license: null,
				},
			}),
			mocha,
		);
		expect(svg.match(/>—<\/text>/g)).toHaveLength(4);
	});
	it("elides a value too long to fit beside its label", () => {
		const svg = renderStats(
			data({ stats: { ...data().stats, license: "BSD-3-Clause-Clear" } }),
			mocha,
		);
		expect(svg).toContain(">BSD-3-Clause-…</text>");
		expect(svg).not.toContain("BSD-3-Clause-Clear");
	});
	it("shows the language count in the header", () => {
		expect(renderStats(data(), mocha)).toContain("LANGUAGES · 15");
	});
	it("fills the bar exactly and colours by rank, with Other last", () => {
		const svg = renderStats(data(), mocha);
		const segs = [
			...svg.matchAll(
				new RegExp(
					`<rect class="st-seg" x="([\\d.]+)" y="${LAYOUT.barY}" width="([\\d.]+)" height="10" fill="(#[0-9a-f]+)"`,
					"g",
				),
			),
		];
		expect(segs).toHaveLength(9);
		const last = segs.at(-1);
		expect(Number(last?.[1]) + Number(last?.[2])).toBeCloseTo(LAYOUT.width, 3);
		expect(segs[0]?.[3]).toBe(RAMP.mocha.colors[0]);
		expect(last?.[3]).toBe(RAMP.mocha.other);
		expect(svg).toContain("Other");
	});
	it("lays out the legend in rows of 4 and grows the card", () => {
		const one = h(
			renderStats(
				data({ langs: { top: [lang("Python", 100)], otherPct: 0, count: 1 } }),
				mocha,
			),
		);
		const five = h(
			renderStats(
				data({
					langs: {
						top: ["A", "B", "C", "D", "E"].map((n) => lang(n, 20)),
						otherPct: 0,
						count: 15,
					},
				}),
				mocha,
			),
		);
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
		const svg = renderStats(
			data({
				langs: { top: [], otherPct: 0, count: 15 },
				total: 0,
				since: null,
				current: null,
				longest: null,
			}),
			mocha,
		);
		expect(svg).not.toContain("LANGUAGES");
		expect(svg).toContain(">—<");
		// outside <style>: the embedded font's base64 can contain "NaN" by chance
		expect(svg.replace(/<style>[\s\S]*?<\/style>/g, "")).not.toContain("NaN");
	});
	it("escapes language names (Review Focus 3)", () => {
		const svg = renderStats(
			data({
				langs: {
					top: [lang("C++", 50), lang("<x>&", 50)],
					otherPct: 0,
					count: 15,
				},
			}),
			mocha,
		);
		expect(svg).toContain("&lt;x&gt;&amp;");
		expect(svg).toContain(">C++<");
	});
	it("uses Latte colours for the light flavor", () => {
		const svg = renderStats(data(), { flavor: "latte", languages: 8 });
		expect(svg).toContain(FLAVORS.latte.background);
		expect(svg).toContain(RAMP.latte.colors[0]);
	});
});
