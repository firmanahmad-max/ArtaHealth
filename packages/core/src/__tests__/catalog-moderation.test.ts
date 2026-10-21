import { describe, it, expect } from "vitest";
import { isPlausibleContribution, catalogEntryStatus } from "../catalog-moderation.ts";
import type { NutritionInput } from "../nutrition.ts";

const ni = (serving: NutritionInput["serving"], extra?: Partial<NutritionInput>): NutritionInput => ({
  foodForm: "solid", serving, servingSize: 30, servingsPerPack: 1, ...extra,
});

describe("isPlausibleContribution", () => {
  it("produk wajar → ok", () => {
    expect(isPlausibleContribution(ni({ sugarG: 12, sodiumMg: 300, totalFatG: 8, energyKcal: 150 })).ok).toBe(true);
  });
  it("nilai garbage (negatif / sangat besar) → ditolak dgn alasan", () => {
    const neg = isPlausibleContribution(ni({ sugarG: -5 }));
    expect(neg.ok).toBe(false);
    expect(neg.reasons.join(" ")).toContain("sugarG");
    const huge = isPlausibleContribution(ni({ sodiumMg: 999999 }));
    expect(huge.ok).toBe(false);
    expect(huge.reasons.join(" ")).toContain("sodiumMg");
  });
  it("servingSize/servingsPerPack & foodForm tak wajar → ditolak", () => {
    expect(isPlausibleContribution(ni({ sugarG: 1 }, { servingSize: 0 })).ok).toBe(false);
    expect(isPlausibleContribution(ni({ sugarG: 1 }, { servingsPerPack: 9999 })).ok).toBe(false);
    expect(isPlausibleContribution(ni({ sugarG: 1 }, { foodForm: "x" as never })).ok).toBe(false);
  });
  it("field kosong diabaikan (parsial boleh)", () => {
    expect(isPlausibleContribution(ni({ sodiumMg: 400 })).ok).toBe(true);
  });
});

describe("catalogEntryStatus", () => {
  it("tepercaya saat kontribusi ≥ ambang; confidence 0..1", () => {
    expect(catalogEntryStatus({ contributions: 1, flags: 0 })).toMatchObject({ trust: "unverified" });
    expect(catalogEntryStatus({ contributions: 3, flags: 0 }).trust).toBe("trusted");
    expect(catalogEntryStatus({ contributions: 1, flags: 0 }).confidence).toBeCloseTo(1 / 3, 5);
    expect(catalogEntryStatus({ contributions: 9, flags: 0 }).confidence).toBe(1);
  });
  it("laporan ≥ ambang → disembunyikan", () => {
    expect(catalogEntryStatus({ contributions: 10, flags: 3 }).hidden).toBe(true);
    expect(catalogEntryStatus({ contributions: 10, flags: 2 }).hidden).toBe(false);
  });
  it("ambang kustom", () => {
    expect(catalogEntryStatus({ contributions: 5, flags: 1 }, { minTrusted: 5, hideAtFlags: 1 }))
      .toMatchObject({ trust: "trusted", hidden: true });
  });
});
