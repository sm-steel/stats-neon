import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchContributions, fetchExtras, fetchProfile } from "./github.ts";
import { parseOutput } from "./options.ts";
import { type CardData, renderStats } from "./render.ts";
import { languages, repoStats } from "./stats.ts";
import { streaks } from "./streaks.ts";

export async function collect(
	login: string,
	token: string,
	now: Date = new Date(),
	fetchFn: typeof fetch = fetch,
): Promise<CardData> {
	const profile = {
		...(await fetchProfile(login, token, fetchFn)),
		...(await fetchExtras(login, token, fetchFn)),
	};
	const { total, days } = await fetchContributions(
		profile.login,
		profile.createdAt,
		token,
		now,
		fetchFn,
	);
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
export async function generate(
	data: CardData,
	outputs: string[],
): Promise<string[]> {
	const specs = outputs.filter((l) => l.trim()).map(parseOutput);
	if (specs.length === 0) throw new Error("No outputs given");
	for (const spec of specs) {
		await mkdir(dirname(spec.path), { recursive: true });
		await writeFile(spec.path, renderStats(data, spec));
	}
	return specs.map((s) => s.path);
}
