import { describe, it, expect } from "vitest";
import { compareImsakiyah, parseHHMM } from "../fasting/imsakiyah-verify.ts";

describe("parseHHMM", () => {
  it("parse valid; tolak invalid", () => {
    expect(parseHHMM("04:38")).toBe(4 * 60 + 38);
    expect(parseHHMM("18:05")).toBe(18 * 60 + 5);
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM("4:3")).toBeNull();
    expect(parseHHMM("abc")).toBeNull();
  });
});

describe("compareImsakiyah", () => {
  it("dalam toleranse ±2 → lolos; delta bertanda", () => {
    const r = compareImsakiyah([
      { label: "Jakarta imsak", appMinutes: 278, refMinutes: 278 },   // 0
      { label: "Jakarta maghrib", appMinutes: 1085, refMinutes: 1083 }, // +2
      { label: "Medan subuh", appMinutes: 290, refMinutes: 291 },      // -1
    ]);
    expect(r.allWithin).toBe(true);
    expect(r.mismatches).toBe(0);
    expect(r.maxAbsDelta).toBe(2);
    expect(r.rows[1]!.deltaMin).toBe(2);
    expect(r.rows[2]!.deltaMin).toBe(-1);
  });
  it("selisih > toleransi → mismatch & gagal", () => {
    const r = compareImsakiyah([
      { label: "ok", appMinutes: 300, refMinutes: 301 },
      { label: "meleset", appMinutes: 300, refMinutes: 305 }, // -5
    ]);
    expect(r.allWithin).toBe(false);
    expect(r.mismatches).toBe(1);
    expect(r.maxAbsDelta).toBe(5);
    expect(r.rows[1]!.withinTolerance).toBe(false);
  });
  it("toleransi kustom", () => {
    expect(compareImsakiyah([{ label: "x", appMinutes: 100, refMinutes: 103 }], 3).allWithin).toBe(true);
    expect(compareImsakiyah([{ label: "x", appMinutes: 100, refMinutes: 103 }], 2).allWithin).toBe(false);
  });
  it("nilai non-finite dianggap mismatch", () => {
    const r = compareImsakiyah([{ label: "bad", appMinutes: NaN, refMinutes: 300 }]);
    expect(r.allWithin).toBe(false);
    expect(r.rows[0]!.withinTolerance).toBe(false);
  });
});
