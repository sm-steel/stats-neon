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
	if (!isFlavor(flavor))
		throw new Error(
			`Unknown flavor "${flavor}" (expected latte, frappe, macchiato or mocha)`,
		);
	const raw = params.get("languages") ?? "8";
	const languages = Number(raw);
	if (!Number.isInteger(languages) || languages < 1 || languages > 8)
		throw new Error(
			`languages must be a whole number from 1 to 8, got "${raw}"`,
		);
	return { path, flavor, languages };
}
