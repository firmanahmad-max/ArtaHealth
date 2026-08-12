import { describe, it, expect } from "vitest";
import {
  computeHealthScore, sleepSubScore, hydrationSubScore, activitySubScore,
} from "../scoring/health-score";

/**
 * Kalibrasi Health Score hari puasa (addendum-ramadan §5). BOBOT TETAP
 * (30/20/25/10/15); hanya NORMALISASI sub-skor yang berubah. Suite terpisah,
 * cakupan penuh cabang puasa (checklist §10).
 */

describe("tidur — hari puasa: rentang sehat 6–9 jam agregat", () => {
  it("6 jam (360 mnt) penuh saat puasa, tapi kurang saat normal (bangun sahur tak dihukum)", () => {
    expect(sleepSubScore(360, undefined, true)).toBe(100);
    expect(sleepSubScore(360)).toBe(76);            // 100 − (420−360)·0.4
  });
  it("di bawah 6 jam tetap penalti linear dari batas puasa", () => {
    expect(sleepSubScore(300, undefined, true)).toBe(76); // 100 − (360−300)·0.4
  });
  it("batas atas 9 jam & penalti tidur berlebih sama seperti normal", () => {
    expect(sleepSubScore(540, undefined, true)).toBe(100);
    expect(sleepSubScore(600, undefined, true)).toBe(76); // 100 − (600−540)·0.4
  });
  it("penalti deviasi jam tidur tetap berlaku saat puasa (baseline dihitung upstream)", () => {
    expect(sleepSubScore(465, 145, true)).toBe(80);
  });
});

describe("hidrasi — hari puasa: bonus distribusi (pola 2-4-2)", () => {
  it("≥3 sesi memberi bonus +10 → skor penuh lebih mudah", () => {
    expect(hydrationSubScore(2275, 2500, true, 3)).toBe(100); // 91 + 10 → cap 100
    expect(hydrationSubScore(1250, 2500, true, 3)).toBe(60);  // 50 + 10
  });
  it("tanpa puasa mengabaikan sesi; <3 sesi tak diberi bonus", () => {
    expect(hydrationSubScore(2275, 2500)).toBe(91);
    expect(hydrationSubScore(2275, 2500, true, 2)).toBe(91);
    expect(hydrationSubScore(2275, 2500, true)).toBe(91);     // sessions undefined
  });
  it("bonus tidak melampaui 100; target ≤0 → 0", () => {
    expect(hydrationSubScore(2500, 2500, true, 4)).toBe(100);
    expect(hydrationSubScore(1000, 0, true, 3)).toBe(0);
  });
});

describe("aktivitas — hari puasa: target langkah ×0,7", () => {
  it("langkah dinilai terhadap 70% target", () => {
    expect(activitySubScore(5600, 8000, undefined, true)).toBe(100); // 5600 / (8000·0.7)
    expect(activitySubScore(5600, 8000)).toBe(70);                   // normal
    expect(activitySubScore(2800, 8000, undefined, true)).toBe(50);  // 2800 / 5600
  });
  it("olahraga (menit) tak terpengaruh kalibrasi puasa; blend 60/40 tetap", () => {
    expect(activitySubScore(undefined, 8000, 11, true)).toBe(50);    // exScore saja
    expect(activitySubScore(5600, 8000, 22, true)).toBe(100);        // 0.6·100 + 0.4·100
  });
});

describe("computeHealthScore — konteks puasa & bobot tetap", () => {
  it("hari puasa memberi breakdown.context='fasting'", () => {
    const r = computeHealthScore({ sleep: { durationMin: 450 }, mood: 4, fasting: true });
    expect(r.breakdown.context).toBe("fasting");
  });
  it("hari not_fasting tidak menyetel context (normalisasi normal)", () => {
    const r = computeHealthScore({ sleep: { durationMin: 450 }, mood: 4, fasting: false });
    expect(r.breakdown.context).toBeUndefined();
    const r2 = computeHealthScore({ sleep: { durationMin: 450 }, mood: 4 });
    expect(r2.breakdown.context).toBeUndefined();
  });
  it("bobot tetap: semua sub-skor 100 pada hari puasa → skor 100", () => {
    const r = computeHealthScore({
      sleep: { durationMin: 450 },
      hydration: { intakeMl: 2500, targetMl: 2500, sessions: 3 },
      activity: { steps: 5600, stepTarget: 8000 },
      mood: 5,
      habits: { completed: 3, total: 3 },
      fasting: true,
    });
    expect(r.score).toBe(100);
    expect(r.breakdown.context).toBe("fasting");
  });
  it("normalisasi puasa berbeda dari normal untuk input yang sama (hari campuran: batal siang → normal)", () => {
    const inputs = {
      sleep: { durationMin: 400 },                               // puasa:100 (≥360) · normal:92 (100−(420−400)·0.4)
      hydration: { intakeMl: 2500, targetMl: 2500, sessions: 3 },
      activity: { steps: 5600, stepTarget: 8000 },               // puasa:100 · normal:70
      mood: 5 as const, habits: { completed: 3, total: 3 },
    };
    const puasa = computeHealthScore({ ...inputs, fasting: true });
    const batal = computeHealthScore({ ...inputs, fasting: false }); // status jadi not_fasting
    expect(puasa.score).toBe(100);
    // normal: 0.3·92 + 0.2·100 + 0.25·70 + 0.1·100 + 0.15·100 = 90.1 → 90
    expect(batal.score).toBe(90);
    expect(puasa.score).toBeGreaterThan(batal.score);
    expect(batal.breakdown.context).toBeUndefined();
  });
});
