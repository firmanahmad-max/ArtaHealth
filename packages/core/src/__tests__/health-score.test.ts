import { describe, it, expect } from "vitest";
import {
  computeHealthScore, sleepSubScore, hydrationSubScore, activitySubScore,
  moodSubScore, habitSubScore,
} from "../scoring/health-score";

describe("sub-skor", () => {
  it("tidur 7–9 jam = 100; di luar rentang turun linear", () => {
    expect(sleepSubScore(465)).toBe(100);          // 7j45m (kasus prototipe)
    expect(sleepSubScore(420)).toBe(100);
    expect(sleepSubScore(540)).toBe(100);
    expect(sleepSubScore(360)).toBe(100 - 60 * 0.4); // kurang 1 jam → 76
    expect(sleepSubScore(0)).toBe(0);
  });
  it("deviasi jam tidur >45 mnt memberi penalti maks 20", () => {
    expect(sleepSubScore(465, 30)).toBe(100);
    expect(sleepSubScore(465, 145)).toBe(80);      // (145-45)*0.2 = 20
    expect(sleepSubScore(465, 500)).toBe(80);      // penalti dibatasi 20
  });
  it("hidrasi proporsional dan di-cap 100", () => {
    expect(hydrationSubScore(2100, 2500)).toBe(84);
    expect(hydrationSubScore(3000, 2500)).toBe(100);
    expect(hydrationSubScore(0, 2500)).toBe(0);
    expect(hydrationSubScore(500, 0)).toBe(0);
  });
  it("aktivitas: hanya langkah bila exerciseMin tidak ada; blend 60/40 bila ada", () => {
    expect(activitySubScore(8456, 8000)).toBe(100);          // cap
    expect(activitySubScore(4000, 8000)).toBe(50);
    expect(activitySubScore(8000, 8000, 0)).toBe(60);        // 0.6*100 + 0.4*0
    expect(activitySubScore(8000, 8000, 22)).toBe(100);
  });
  it("aktivitas hanya durasi (tanpa langkah) dinilai dari durasi saja", () => {
    expect(activitySubScore(undefined, 8000, 22)).toBe(100);
    expect(activitySubScore(undefined, 8000, 11)).toBe(50);
    expect(activitySubScore(undefined, 8000)).toBe(0);
  });
  it("mood dan habit", () => {
    expect(moodSubScore(4)).toBe(80);
    expect(habitSubScore(3, 5)).toBe(60);
    expect(habitSubScore(0, 0)).toBe(0);
  });
});

describe("computeHealthScore", () => {
  it("kasus prototipe = 89", () => {
    const r = computeHealthScore({
      sleep: { durationMin: 465 },
      hydration: { intakeMl: 2100, targetMl: 2500 },
      activity: { steps: 8456, stepTarget: 8000 },
      mood: 4,
      habits: { completed: 3, total: 5 },
    });
    expect(r.score).toBe(89); // 30 + 16.8 + 25 + 8 + 9 = 88.8 → 89
    expect(r.breakdown.sleep).toBe(30);
    expect(r.breakdown.hydration).toBe(16.8);
  });

  it("log air 250ml menaikkan skor (loop inti produk)", () => {
    const before = computeHealthScore({
      sleep: { durationMin: 465 }, hydration: { intakeMl: 2100, targetMl: 2500 },
      activity: { steps: 8456, stepTarget: 8000 }, mood: 4, habits: { completed: 3, total: 5 },
    });
    const after = computeHealthScore({
      sleep: { durationMin: 465 }, hydration: { intakeMl: 2350, targetMl: 2500 },
      activity: { steps: 8456, stepTarget: 8000 }, mood: 4, habits: { completed: 3, total: 5 },
    });
    expect(after.score).toBeGreaterThan(before.score);
  });

  it("parameter tanpa data tidak menghukum: bobot diredistribusi", () => {
    // Hanya tidur sempurna → skor 100, bukan 30.
    const r = computeHealthScore({ sleep: { durationMin: 480 } });
    expect(r.score).toBe(100);
    expect(r.breakdown.hydration).toBe("no_data");
  });

  it("redistribusi proporsional dua parameter", () => {
    // tidur 100 (bobot 0.3) + mood 80 (bobot 0.1) → (0.75*100)+(0.25*80)=95
    const r = computeHealthScore({ sleep: { durationMin: 480 }, mood: 4 });
    expect(r.score).toBe(95);
  });

  it("tanpa data sama sekali → 0 dan semua no_data", () => {
    const r = computeHealthScore({});
    expect(r.score).toBe(0);
    expect(r.breakdown.sleep).toBe("no_data");
  });

  it("skor selalu integer 0–100", () => {
    const r = computeHealthScore({
      sleep: { durationMin: 300 }, hydration: { intakeMl: 999, targetMl: 2500 },
      activity: { steps: 1234, stepTarget: 8000 }, mood: 2, habits: { completed: 1, total: 4 },
    });
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
