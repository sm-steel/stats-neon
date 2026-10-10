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
