import { describe, it, expect } from "vitest";
import { dedupeSamples, rollupDaily, chooseSource, type WearableSample } from "../wearable.ts";

// waktu LOKAL (tanpa Z) agar rollup per-hari-lokal konsisten lintas timezone runner
const s = (p: Partial<WearableSample>): WearableSample => ({
  externalId: "x", type: "steps", value: 1, unit: "count",
  startAt: "2026-09-01T08:00:00", source: "health_connect", ...p,
});

describe("dedupeSamples", () => {
  it("buang duplikat (source, externalId) — ambil terakhir", () => {
    const out = dedupeSamples([s({ externalId: "a", value: 100 }), s({ externalId: "a", value: 200 }), s({ externalId: "b", value: 5 })]);
    expect(out.length).toBe(2);
    expect(out.find((x) => x.externalId === "a")!.value).toBe(200);
  });
  it("sumber berbeda dgn id sama tak dianggap duplikat", () => {
    const out = dedupeSamples([s({ externalId: "a", source: "health_connect" }), s({ externalId: "a", source: "healthkit" })]);
    expect(out.length).toBe(2);
  });
  it("abaikan nilai non-finite", () => {
    expect(dedupeSamples([s({ externalId: "a", value: NaN })]).length).toBe(0);
  });
});

describe("rollupDaily", () => {
  it("langkah dijumlahkan per hari", () => {
    const r = rollupDaily([
      s({ externalId: "1", type: "steps", value: 1000, startAt: "2026-09-01T08:00:00" }),
      s({ externalId: "2", type: "steps", value: 2500, startAt: "2026-09-01T18:00:00" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ day: "2026-09-01", type: "steps", value: 3500, n: 2 });
  });
  it("detak jantung dirata-rata", () => {
    const r = rollupDaily([
      s({ externalId: "1", type: "heart_rate", unit: "bpm", value: 60 }),
      s({ externalId: "2", type: "heart_rate", unit: "bpm", value: 70 }),
    ]);
    expect(r[0]!.value).toBe(65);
  });
  it("berat = sampel terbaru", () => {
    const r = rollupDaily([
      s({ externalId: "1", type: "weight", unit: "kg", value: 70, startAt: "2026-09-01T07:00:00" }),
      s({ externalId: "2", type: "weight", unit: "kg", value: 69.5, startAt: "2026-09-01T20:00:00" }),
    ]);
    expect(r[0]!.value).toBe(69.5);
  });
  it("pisah per hari lokal & urut", () => {
    const r = rollupDaily([
      s({ externalId: "b", type: "steps", value: 100, startAt: "2026-09-02T08:00:00" }),
      s({ externalId: "a", type: "steps", value: 100, startAt: "2026-09-01T08:00:00" }),
    ]);
    expect(r.map((x) => x.day)).toEqual(["2026-09-01", "2026-09-02"]);
  });
});

describe("chooseSource", () => {
  it("utamakan wearable bila keduanya ada", () => {
    expect(chooseSource(8000, 5000)).toBe(8000);
    expect(chooseSource(8000, 5000, "manual")).toBe(5000);
  });
  it("pakai yang tersedia bila satu null", () => {
    expect(chooseSource(null, 5000)).toBe(5000);
    expect(chooseSource(8000, null)).toBe(8000);
    expect(chooseSource(null, null)).toBeNull();
  });
});
