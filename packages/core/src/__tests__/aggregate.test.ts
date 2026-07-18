import { describe, it, expect } from "vitest";
import { aggregateDayInputs } from "../aggregate";
import { computeHealthScore } from "../scoring/health-score";

const targets = { hydrationMl: 2500, steps: 8000 };

describe("aggregateDayInputs", () => {
  it("hidrasi dijumlahkan; tidur pakai sesi terpanjang; mood pakai yang terakhir", () => {
    const inputs = aggregateDayInputs(
      {
        hydration: [{ volumeMl: 250 }, { volumeMl: 600 }, { volumeMl: 250 }],
        sleep: [
          { sleepStart: "2026-07-18T14:00:00Z", sleepEnd: "2026-07-18T14:30:00Z" }, // tidur siang 30m
          { sleepStart: "2026-07-17T15:30:00Z", sleepEnd: "2026-07-17T23:15:00Z" }, // tidur utama 7j45m
        ],
        mood: [
          { mood: 2, loggedAt: "2026-07-18T01:00:00Z" },
          { mood: 4, loggedAt: "2026-07-18T09:00:00Z" },
        ],
      },
      targets,
    );
    expect(inputs.hydration).toEqual({ intakeMl: 1100, targetMl: 2500 });
    expect(inputs.sleep).toEqual({ durationMin: 465 });
    expect(inputs.mood).toBe(4);
    expect(inputs.activity).toBeUndefined();
    expect(inputs.habits).toBeUndefined();
  });

  it("aktivitas: durasi dijumlah; langkah hanya bila ada log berlangkah", () => {
    const durOnly = aggregateDayInputs(
      { activity: [{ durationMin: 20 }, { durationMin: 15, steps: null }] },
      targets,
    );
    expect(durOnly.activity).toEqual({ steps: undefined, stepTarget: 8000, exerciseMin: 35 });

    const mixed = aggregateDayInputs(
      { activity: [{ durationMin: 30, steps: 3500 }, { steps: 2000 }] },
      targets,
    );
    expect(mixed.activity).toEqual({ steps: 5500, stepTarget: 8000, exerciseMin: 30 });
  });

  it("hari kosong → inputs kosong → skor 0 (bukan crash)", () => {
    const inputs = aggregateDayInputs({}, targets);
    expect(inputs).toEqual({});
    expect(computeHealthScore(inputs).score).toBe(0);
  });

  it("hasil agregasi valid sebagai input engine end-to-end", () => {
    const inputs = aggregateDayInputs(
      {
        hydration: [{ volumeMl: 2100 }],
        sleep: [{ sleepStart: "2026-07-17T15:30:00Z", sleepEnd: "2026-07-17T23:15:00Z" }],
        activity: [{ steps: 8456 }],
        mood: [{ mood: 4, loggedAt: "2026-07-18T09:00:00Z" }],
        habits: { completed: 3, total: 5 },
      },
      targets,
    );
    expect(computeHealthScore(inputs).score).toBe(89); // kasus prototipe
  });
});
