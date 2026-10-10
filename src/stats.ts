import { fmtAge } from "./format.ts";
import type { Profile, Repo } from "./types.ts";

export interface Lang {
	name: string;
	size: number;
	pct: number;
}

/**
 * Top `n` languages by code size over non-fork repos, the percentage of the rest,
 * and how many distinct languages there are.
 */
export function languages(
	repos: Repo[],
	n: number,
): { top: Lang[]; otherPct: number; count: number } {
	const sizes = new Map<string, number>();
	for (const r of repos) {
		if (r.isFork) continue;
		for (const e of r.languages.edges)
			sizes.set(e.node.name, (sizes.get(e.node.name) ?? 0) + e.size);
	}
	const total = [...sizes.values()].reduce((a, b) => a + b, 0);
	if (total === 0) return { top: [], otherPct: 0, count: 0 };
	const all = [...sizes]
		.map(([name, size]) => ({ name, size, pct: (100 * size) / total }))
		.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
	const top = all.slice(0, n);
	return {
		top,
		otherPct: all.slice(n).reduce((s, l) => s + l.pct, 0),
		count: all.length,
	};
}

export interface RepoStats {
	repos: number;
	contributedTo: number;
	stars: number;
	releases: number;
	followers: number;
	joined: string;
	forks: number;
	watchers: number;
	/** Most common declared SPDX license, or null. */
	license: string | null;
	/** Best-effort fields: null when GitHub hid them from the token. */
	sponsors: number | null;
	packages: number | null;
	diskKB: number | null;
}

/** The most common real license among the repos (ignoring none and NOASSERTION). */
function preferredLicense(repos: Repo[]): string | null {
	const counts = new Map<string, number>();
	for (const r of repos) {
		const id = r.licenseInfo?.spdxId;
		if (id && id !== "NOASSERTION") counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	let best: string | null = null;
	for (const [id, n] of counts)
		if (!best || n > (counts.get(best) ?? 0)) best = id;
	return best;
}

export function repoStats(p: Profile, now: Date): RepoStats {
	const sum = (f: (r: Repo) => number) => p.repos.reduce((s, r) => s + f(r), 0);
	return {
		repos: p.repoCount,
		contributedTo: p.contributedTo,
		stars: sum((r) => r.stargazerCount),
		releases: sum((r) => r.releases.totalCount),
		followers: p.followers,
		joined: fmtAge(p.createdAt, now),
		forks: sum((r) => r.forkCount),
		watchers: sum((r) => r.watchers.totalCount),
		license: preferredLicense(p.repos),
		sponsors: p.sponsors,
		packages: p.packages,
		diskKB: p.diskKB,
	};
}
