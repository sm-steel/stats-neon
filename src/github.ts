import type { Day, Profile, Repo } from "./types.ts";

const ENDPOINT = "https://api.github.com/graphql";

async function gql<T>(
	query: string,
	variables: Record<string, unknown>,
	token: string,
	fetchFn: typeof fetch,
): Promise<T> {
	const res = await fetchFn(ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `bearer ${token}`,
			"Content-Type": "application/json",
			"User-Agent": "stats-neon",
		},
		body: JSON.stringify({ query, variables }),
	});
	if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
	const json = (await res.json()) as {
		data?: T;
		errors?: { message: string }[];
	};
	if (json.errors?.length)
		throw new Error(json.errors.map((e) => e.message).join("; "));
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
		repositories: {
			totalCount: number;
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
			nodes: Repo[];
		};
	} | null;
}

export async function fetchProfile(
	login: string,
	token: string,
	fetchFn: typeof fetch = fetch,
	maxPages = 10,
): Promise<Profile> {
	const repos: Repo[] = [];
	let after: string | null = null;
	let head: NonNullable<ProfileData["user"]> | undefined;
	for (let page = 0; page < maxPages; page++) {
		const { user }: ProfileData = await gql<ProfileData>(
			PROFILE_QUERY,
			{ login, after },
			token,
			fetchFn,
		);
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
	if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(createdAt))
		throw new Error(`Unexpected createdAt "${createdAt}"`);
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
	contributionCalendar: {
		totalContributions: number;
		weeks: {
			contributionDays: { date: string; contributionCount: number }[];
		}[];
	};
}

export async function fetchContributions(
	login: string,
	createdAt: string,
	token: string,
	now: Date = new Date(),
	fetchFn: typeof fetch = fetch,
): Promise<{ total: number; days: Day[] }> {
	const { user } = await gql<{ user: Record<string, Calendar> | null }>(
		contributionsQuery(createdAt, now),
		{ login },
		token,
		fetchFn,
	);
	if (!user) throw new Error(`GitHub user "${login}" not found`);
	let total = 0;
	const days: Day[] = [];
	for (const year of Object.values(user)) {
		total += year.contributionCalendar.totalContributions;
		for (const w of year.contributionCalendar.weeks)
			for (const d of w.contributionDays)
				days.push({ date: d.date, count: d.contributionCount });
	}
	return { total, days };
}
