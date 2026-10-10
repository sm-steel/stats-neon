import {
	CHAR_WIDTH_EM,
	card,
	esc,
	FLAVORS,
	FONT_STACK,
	type Palette,
	r3,
} from "@sm-steel/neon-kit";
import { fmtInt, fmtRun, fmtSince } from "./format.ts";
import { ICONS } from "./icons.ts";
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
	langs: { top: Lang[]; otherPct: number; count: number };
	currentYear: number;
}

export const LAYOUT = {
	width: 868,
	gap: 10,
	tileH: 78,
	/** Stat cells: 4 × 3 badge-like frames, `cellGap` apart both ways. */
	gridY: 90,
	cellH: 24,
	cellGap: 8,
	langY: 202,
	barY: 212,
	barH: 10,
	legendY: 242,
	rowH: 20,
	cols: 4,
} as const;

const TILE_W = (LAYOUT.width - 2 * LAYOUT.gap) / 3;
const CELL_W =
	(LAYOUT.width - (LAYOUT.cols - 1) * LAYOUT.cellGap) / LAYOUT.cols;
const COL_W = CELL_W + LAYOUT.cellGap;
const GRID_BOTTOM = LAYOUT.gridY + 3 * LAYOUT.cellH + 2 * LAYOUT.cellGap;

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

const dash = (v: number | null) => (v === null ? "—" : fmtInt(v));

/** Cuts `value` with "…" so it fits in `room` px of 12px bold monospace. */
function fitValue(value: string, room: number): string {
	const max = Math.floor(room / (12 * CHAR_WIDTH_EM));
	const chars = [...value];
	return chars.length <= max ? value : `${chars.slice(0, max - 1).join("")}…`;
}

/** Corner brackets of a cell, 5px long. */
function brackets(x: number, y: number, w: number, h: number, c: string) {
	const s = 5;
	const r = r3(x + w);
	const b = y + h;
	const d =
		`M${x} ${y + s}V${y}H${r3(x + s)}` +
		`M${r3(r - s)} ${y}H${r}V${y + s}` +
		`M${r} ${b - s}V${b}H${r3(r - s)}` +
		`M${r3(x + s)} ${b}H${x}V${b - s}`;
	return `<path d="${d}" fill="none" stroke="${c}" stroke-opacity="0.5"/>`;
}

/** 4 × 3 grid of badge-like cells: Octicon + LABEL on the left, value on the right. */
function statsGrid(s: RepoStats, p: Palette): string {
	const items: [string, string, string][] = [
		["repo", "REPOS", fmtInt(s.repos)],
		["star", "STARS", fmtInt(s.stars)],
		["repo-forked", "FORKERS", fmtInt(s.forks)],
		["eye", "WATCHERS", fmtInt(s.watchers)],
		["repo-push", "CONTRIBUTED TO", fmtInt(s.contributedTo)],
		["tag", "RELEASES", fmtInt(s.releases)],
		["package", "PACKAGES", dash(s.packages)],
		["heart", "SPONSORS", dash(s.sponsors)],
		["people", "FOLLOWERS", fmtInt(s.followers)],
		["calendar", "JOINED", s.joined],
		["law", "LICENSE", s.license ?? "—"],
		[
			"database",
			"DISK",
			s.diskKB === null ? "—" : `${(s.diskKB / 1000).toFixed(1)} MB`,
		],
	];
	return items
		.map(([icon, label, value], i) => {
			const x = r3((i % LAYOUT.cols) * COL_W);
			const y =
				LAYOUT.gridY +
				Math.floor(i / LAYOUT.cols) * (LAYOUT.cellH + LAYOUT.cellGap);
			const base = y + 16;
			// label: 11px + 1px letter-spacing from x+30; value ends at x+CELL_W-10; 8px between
			const room =
				CELL_W - 10 - (30 + label.length * (11 * CHAR_WIDTH_EM + 1)) - 8;
			return (
				`<rect class="st-cell" x="${x}" y="${y}" width="${r3(CELL_W)}" height="${LAYOUT.cellH}" fill="${p.accent}" fill-opacity="0.03" stroke="${p.border}" stroke-opacity="0.6"/>` +
				brackets(x, y, CELL_W, LAYOUT.cellH, p.accent) +
				`<svg class="st-icon" x="${r3(x + 9)}" y="${y + 5}" width="14" height="14" viewBox="0 0 16 16"><path d="${ICONS[icon]}" fill="${p.accent}"/></svg>` +
				`<text x="${r3(x + 30)}" y="${base}" font-size="11" letter-spacing="1" fill="${p.subtext}">${label}</text>` +
				`<text class="st-val" x="${r3(x + CELL_W - 10)}" y="${base}" text-anchor="end" font-size="12" font-weight="700" fill="${p.accent}">${esc(fitValue(value, room))}</text>`
			);
		})
		.join("");
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
	if (top.length === 0) return { svg: "", height: GRID_BOTTOM + 2 };
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
			`<text x="0" y="${LAYOUT.langY}" font-size="10" letter-spacing="1.2" fill="${p.text}"><tspan fill="${p.accent}">//</tspan> LANGUAGES · ${d.langs.count}</text>` +
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
		statsGrid(d.stats, p) +
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
