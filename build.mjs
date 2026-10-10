// Bundles the action and CLI into self-contained files in dist/ (committed, so
// the action runs without npm install).
import { build } from "esbuild";

for (const entry of ["action", "cli"]) {
	await build({
		entryPoints: [`src/${entry}.ts`],
		outfile: `dist/${entry}.js`,
		bundle: true,
		platform: "node",
		target: "node22",
		format: "esm",
		legalComments: "none",
	});
}
