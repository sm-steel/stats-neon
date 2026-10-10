// GitHub Action entry point. Inputs arrive as INPUT_<NAME> environment variables.
import { collect, generate } from "./generate.ts";

function input(name: string): string {
	const value = (process.env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
	if (!value) throw new Error(`Input required: ${name}`);
	return value;
}

async function main() {
	const data = await collect(input("github_user_name"), input("github_token"));
	console.log(
		`${data.login}: ${data.total} contributions, current streak ${data.current?.length ?? 0}, longest ${data.longest?.length ?? 0}`,
	);
	for (const path of await generate(data, input("outputs").split("\n")))
		console.log(`wrote ${path}`);
}

main().catch((err: unknown) => {
	console.log(`::error::${err instanceof Error ? err.message : err}`);
	process.exit(1);
});
