import { fmtAge } from "./format.ts";
import type { Profile, Repo } from "./types.ts";

export interface Lang {
	name: string;
	size: number;
	pct: number;
}

/** Top `n` languages by code size over non-fork repos, plus the percentage of the rest. */
export function languages(
	repos: Repo[],
	n: number,
): { top: Lang[]; otherPct: number } {
	const sizes = new Map<string, number>();
	for (const r of repos) {
		if (r.isFork) continue;
		for (const e of r.languages.edges)
			sizes.set(e.node.name, (sizes.get(e.node.name) ?? 0) + e.size);
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
