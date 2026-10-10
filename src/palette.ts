import type { Flavor } from "@sm-steel/neon-kit";

/** Catppuccin accents for language ranks 1-8: mauve, blue, teal, green, yellow, peach, red, pink; `other` is overlay0. */
export const RAMP: Record<Flavor, { colors: string[]; other: string }> = {
	latte: {
		colors: [
			"#8839ef",
			"#1e66f5",
			"#179299",
			"#40a02b",
			"#df8e1d",
			"#fe640b",
			"#d20f39",
			"#ea76cb",
		],
		other: "#9ca0b0",
	},
	frappe: {
		colors: [
			"#ca9ee6",
			"#8caaee",
			"#81c8be",
			"#a6d189",
			"#e5c890",
			"#ef9f76",
			"#e78284",
			"#f4b8e4",
		],
		other: "#737994",
	},
	macchiato: {
		colors: [
			"#c6a0f6",
			"#8aadf4",
			"#8bd5ca",
			"#a6da95",
			"#eed49f",
			"#f5a97f",
			"#ed8796",
			"#f5bde6",
		],
		other: "#6e738d",
	},
	mocha: {
		colors: [
			"#cba6f7",
			"#89b4fa",
			"#94e2d5",
			"#a6e3a1",
			"#f9e2af",
			"#fab387",
			"#f38ba8",
			"#f5c2e7",
		],
		other: "#6c7086",
	},
};
