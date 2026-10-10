import {
	card,
	esc,
	FLAVORS,
	FONT_STACK,
	type Palette,
	r3,
} from "@sm-steel/neon-kit";
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

export const LAYOUT = {
	width: 868,
	gap: 10,
	tileH: 78,
	statsY: 108,
	langY: 138,
	barY: 148,
	barH: 10,
	legendY: 178,
	rowH: 20,
	cols: 4,
} as const;

const TILE_W = (LAYOUT.width - 2 * LAYOUT.gap) / 3;
const COL_W = LAYOUT.width / LAYOUT.cols;

function tile(
	i: number,
	value: string,
	label: string,
	range: string,
	p: Palette,
): string {
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
		.map(
			([k, v]) =>
				`<tspan fill="${p.subtext}">${k} </tspan><tspan fill="${p.text}">${esc(v)}</tspan>`,
		)
		.join(`<tspan fill="${p.accent}"> · </tspan>`);
	return `<text x="0" y="${LAYOUT.statsY}" font-size="12" letter-spacing="1">${body}</text>`;
}

function languagesSection(
	d: CardData,
	n: number,
	p: Palette,
	ramp: (typeof RAMP)["mocha"],
): { svg: string; height: number } {
	const top = d.langs.top.slice(0, n);
	const otherPct =
		d.langs.otherPct + d.langs.top.slice(n).reduce((s, l) => s + l.pct, 0);
	if (top.length === 0) return { svg: "", height: LAYOUT.statsY + 8 };
	const entries = [
		...top.map((l, i) => ({
			name: l.name,
			pct: l.pct,
			color: ramp.colors[i] as string,
		})),
		...(otherPct > 0.05
			? [{ name: "Other", pct: otherPct, color: ramp.other }]
			: []),
	];
	let x = 0;
	const segs = entries
		.map((e, i) => {
			const w =
				i === entries.length - 1
					? LAYOUT.width - x
					: (LAYOUT.width * e.pct) / 100;
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

export function renderStats(
	d: CardData,
	o: Pick<OutputSpec, "flavor" | "languages">,
): string {
	const p = FLAVORS[o.flavor];
	const langs = languagesSection(d, o.languages, p, RAMP[o.flavor]);
	const content =
		tile(
			0,
			fmtInt(d.total),
			"Total Contributions",
			fmtSince(d.since, d.currentYear),
			p,
		) +
		tile(
			1,
			fmtInt(d.current?.length ?? 0),
			"Current Streak",
			fmtRun(d.current, d.currentYear),
			p,
		) +
		tile(
			2,
			fmtInt(d.longest?.length ?? 0),
			"Longest Streak",
			fmtRun(d.longest, d.currentYear),
			p,
		) +
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
