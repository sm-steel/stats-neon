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
	it("prints the stats line", () => {
		const svg = renderStats(data(), mocha);
		for (const s of [
			"REPOS",
			">37<",
			"CONTRIBUTED TO",
			">48<",
			"STARS",
			"RELEASES",
			">29<",
			"FOLLOWERS",
			"JOINED",
			">1Y<",
		])
			expect(svg).toContain(s);
	});
	it("fills the bar exactly and colours by rank, with Other last", () => {
		const svg = renderStats(data(), mocha);
		const segs = [
			...svg.matchAll(
				/<rect class="st-seg" x="([\d.]+)" y="148" width="([\d.]+)" height="10" fill="(#[0-9a-f]+)"/g,
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
				data({ langs: { top: [lang("Python", 100)], otherPct: 0 } }),
				mocha,
			),
		);
		const five = h(
			renderStats(
				data({
					langs: {
						top: ["A", "B", "C", "D", "E"].map((n) => lang(n, 20)),
						otherPct: 0,
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
				langs: { top: [], otherPct: 0 },
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
				langs: { top: [lang("C++", 50), lang("<x>&", 50)], otherPct: 0 },
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
