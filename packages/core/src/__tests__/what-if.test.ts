import { describe, it, expect } from "vitest";
import {
  applyLevers, projectScore, combineLevers, WHATIF_PRESETS, type DayInputs,
} from "../index.ts";

// baseline "hari khas" yang belum optimal → ada ruang perbaikan
const base = (): DayInputs => ({
  sleep: { durationMin: 360 },                       // 6 jam (< 7-9)
  hydration: { intakeMl: 1500, targetMl: 2500 },     // 60%
  activity: { steps: 4000, stepTarget: 8000, exerciseMin: 0 },
  mood: 3,
});

describe("applyLevers", () => {
  it("menambah durasi tidur (clamp ≥0)", () => {
    const out = applyLevers(base(), { sleepDeltaMin: 60 });
    expect(out.sleep!.durationMin).toBe(420);
  });
  it("tak menurunkan di bawah 0", () => {
    const out = applyLevers(base(), { hydrationDeltaMl: -5000 });
    expect(out.hydration!.intakeMl).toBe(0);
  });
  it("olahraga boleh naik dari nol", () => {
    const out = applyLevers(base(), { exerciseDeltaMin: 20 });
    expect(out.activity!.exerciseMin).toBe(20);
  });
  it("tak mengubah faktor yang tak ada di baseline", () => {
    const out = applyLevers({ mood: 3 }, { sleepDeltaMin: 60 });
    expect(out.sleep).toBeUndefined();
  });
});

describe("projectScore", () => {
  it("perbaikan tidur menaikkan skor", () => {
    const r = projectScore(base(), { sleepDeltaMin: 120 }); // 6→8 jam
    expect(r.projectedScore).toBeGreaterThan(r.baseScore);
    expect(r.delta).toBe(r.projectedScore - r.baseScore);
  });
  it("hidrasi penuh menaikkan sub-skor hidrasi", () => {
    const r = projectScore(base(), { hydrationDeltaMl: 1000 }); // 1500→2500 = 100%
    expect(r.delta).toBeGreaterThan(0);
  });
  it("tanpa lever → delta 0", () => {
    const r = projectScore(base(), {});
    expect(r.delta).toBe(0);
  });
  it("lever memburuk → delta negatif", () => {
    const r = projectScore(base(), { hydrationDeltaMl: -1500 }); // 1500→0
    expect(r.delta).toBeLessThan(0);
  });
});

describe("combineLevers", () => {
  it("menjumlahkan beberapa preset", () => {
    const combined = combineLevers(WHATIF_PRESETS);
    expect(combined.sleepDeltaMin).toBe(60);
    expect(combined.hydrationDeltaMl).toBe(500);
    expect(combined.stepsDelta).toBe(3000);
    expect(combined.exerciseDeltaMin).toBe(20);
  });
  it("dua preset tidur (hipotetis) dijumlahkan", () => {
    const s = WHATIF_PRESETS.find((p) => p.key === "sleep+60")!;
    expect(combineLevers([s, s]).sleepDeltaMin).toBe(120);
  });
});
