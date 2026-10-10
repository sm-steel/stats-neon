import { describe, expect, it } from "vitest";
import { parseOutput } from "../src/options.ts";
import { RAMP } from "../src/palette.ts";

describe("parseOutput", () => {
	it("defaults to mocha and 8 languages", () => {
		expect(parseOutput(" dist/s.svg ")).toEqual({
			path: "dist/s.svg",
			flavor: "mocha",
			languages: 8,
		});
	});
	it("reads flavor and languages", () => {
		expect(parseOutput("a.svg?flavor=latte&languages=3")).toMatchObject({
			flavor: "latte",
			languages: 3,
		});
	});
	it("rejects unknown flavors and out-of-range language counts", () => {
		expect(() => parseOutput("a.svg?flavor=espresso")).toThrow(/flavor/);
		expect(() => parseOutput("a.svg?languages=0")).toThrow(/languages/);
		expect(() => parseOutput("a.svg?languages=9")).toThrow(/languages/);
		expect(() => parseOutput("a.svg?languages=two")).toThrow(/languages/);
	});
});

describe("RAMP", () => {
	it("has 8 distinct colours plus Other in every flavor", () => {
		for (const r of Object.values(RAMP)) {
			expect(new Set(r.colors).size).toBe(8);
			expect(r.colors).not.toContain(r.other);
		}
		expect(RAMP.mocha.colors[0]).toBe("#cba6f7");
	});
});
