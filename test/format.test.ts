import { describe, expect, it } from "vitest";
import { fmtAge, fmtDay, fmtInt, fmtRun, fmtSince } from "../src/format.ts";

describe("format", () => {
	it("shows the year only outside the current year", () => {
		expect(fmtDay("2026-10-01", 2026)).toBe("Oct 1");
		expect(fmtDay("2025-09-12", 2026)).toBe("Sep 12, 2025");
	});
	it("formats runs, single days and no streak", () => {
		expect(
			fmtRun({ start: "2026-10-01", end: "2026-10-10", length: 10 }, 2026),
		).toBe("Oct 1 – Oct 10");
		expect(
			fmtRun({ start: "2026-10-10", end: "2026-10-10", length: 1 }, 2026),
		).toBe("Oct 10");
		expect(
			fmtRun({ start: "2025-12-30", end: "2026-01-02", length: 4 }, 2026),
		).toBe("Dec 30, 2025 – Jan 2");
		expect(fmtRun(null, 2026)).toBe("—");
	});
	it("formats since and integers", () => {
		expect(fmtSince("2025-06-23", 2026)).toBe("Jun 23, 2025 – now");
		expect(fmtSince(null, 2026)).toBe("—");
		expect(fmtInt(3023)).toBe("3,023");
	});
	it("formats account age at each boundary", () => {
		const now = new Date("2026-10-10T12:00:00Z");
		expect(fmtAge("2025-06-23T10:20:54Z", now)).toBe("1Y");
		expect(fmtAge("2024-10-10T00:00:00Z", now)).toBe("2Y");
		expect(fmtAge("2026-02-01T00:00:00Z", now)).toBe("8MO");
		expect(fmtAge("2026-09-11T00:00:00Z", now)).toBe("29D");
		expect(fmtAge("2026-10-10T00:00:00Z", now)).toBe("0D");
	});
});
