#!/usr/bin/env node
import { parseArgs } from "node:util";
import { collect, generate } from "./generate.ts";

const USAGE = `Usage: stats-neon --user <login> --out <file.svg?flavor=mocha&languages=8> [--out ...] [--token T]
Token defaults to $GITHUB_TOKEN or $GH_TOKEN.`;

async function main() {
	const { values } = parseArgs({
		options: {
			user: { type: "string" },
			out: { type: "string", multiple: true },
			token: { type: "string" },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help || !values.user || !values.out?.length) {
		console.log(USAGE);
		process.exit(values.help ? 0 : 1);
	}
	const token =
		values.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
	if (!token)
		throw new Error("A GitHub token is required (--token or $GITHUB_TOKEN)");
	for (const path of await generate(
		await collect(values.user, token),
		values.out,
	))
		console.log(`wrote ${path}`);
}

main().catch((err: unknown) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
