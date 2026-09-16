import { describe, it, expect } from "vitest";
import { dedupeSamples, rollupDaily, chooseSource, parseWearableImport, type WearableSample } from "../wearable.ts";

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

describe("parseWearableImport", () => {
  it("JSON array → sampel valid; default unit & source; externalId diturunkan", () => {
    const { samples, skipped } = parseWearableImport(JSON.stringify([
      { type: "steps", value: 5000, startAt: "2026-09-01T08:00:00" },
      { type: "heart_rate", value: 62, startAt: "2026-09-01T07:00:00", source: "healthkit", externalId: "hk-1" },
    ]));
    expect(skipped).toBe(0);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toMatchObject({ type: "steps", unit: "count", source: "health_connect", externalId: "imp-steps-2026-09-01T08:00:00" });
    expect(samples[1]).toMatchObject({ type: "heart_rate", source: "healthkit", externalId: "hk-1" });
  });
  it("CSV header by nama (urut bebas) + snake_case", () => {
    const csv = "value,type,start_at,unit\n70,weight,2026-09-02T06:00:00,kg\n2500,steps,2026-09-02T20:00:00,count";
    const { samples, skipped } = parseWearableImport(csv);
    expect(skipped).toBe(0);
    expect(samples.map((s) => s.type)).toEqual(["weight", "steps"]);
    expect(samples[0]!.value).toBe(70);
  });
  it("baris tak valid dilewati (jenis/nilai/tanggal salah), bukan gagal total", () => {
    const { samples, skipped } = parseWearableImport(JSON.stringify([
      { type: "steps", value: 100, startAt: "2026-09-01T08:00:00" },
      { type: "bogus", value: 1, startAt: "2026-09-01T08:00:00" },
      { type: "steps", value: "x", startAt: "2026-09-01T08:00:00" },
      { type: "steps", value: 100, startAt: "bukan-tanggal" },
    ]));
    expect(samples).toHaveLength(1);
    expect(skipped).toBe(3);
  });
  it("hasil impor bisa langsung di-rollup (integrasi engine)", () => {
    const { samples } = parseWearableImport("type,value,start_at\nsteps,1000,2026-09-01T08:00:00\nsteps,2500,2026-09-01T18:00:00");
    const r = rollupDaily(samples);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ day: "2026-09-01", type: "steps", value: 3500 });
  });
  it("teks kosong / JSON rusak → aman ([], 0)", () => {
    expect(parseWearableImport("")).toEqual({ samples: [], skipped: 0 });
    expect(parseWearableImport("{ rusak")).toEqual({ samples: [], skipped: 0 });
  });
});
