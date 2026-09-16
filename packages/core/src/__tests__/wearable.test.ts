import { describe, it, expect } from "vitest";
import { dedupeSamples, rollupDaily, chooseSource, parseWearableImport, parseGoogleFitDailyCsv, parseGoogleFitSessionsJson, latestRollupDay, wearableDaySeries, type WearableSample } from "../wearable.ts";

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

describe("latestRollupDay & wearableDaySeries", () => {
  const rollups = rollupDaily([
    s({ externalId: "a", type: "steps", value: 1000, startAt: "2026-09-01T08:00:00" }),
    s({ externalId: "b", type: "steps", value: 3000, startAt: "2026-09-03T08:00:00" }),
    s({ externalId: "c", type: "sleep", unit: "min", value: 420, startAt: "2026-09-03T02:00:00" }),
  ]);
  it("latestRollupDay = hari terbaru; null bila kosong", () => {
    expect(latestRollupDay(rollups)).toBe("2026-09-03");
    expect(latestRollupDay([])).toBeNull();
  });
  it("deret 4 hari berakhir 3 Sep: isi hari yg ada, null utk yg tak ada, urut lama→baru", () => {
    const series = wearableDaySeries(rollups, "steps", "2026-09-03", 4);
    expect(series.map((x) => x.day)).toEqual(["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(series.map((x) => x.value)).toEqual([null, 1000, null, 3000]);
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

describe("parseGoogleFitDailyCsv (konverter Takeout)", () => {
  const HEADER = "Date,Step count,Calories (kcal),Average heart rate (bpm),Max heart rate (bpm),Average weight (kg),Max weight (kg)";
  it("petakan kolom Fit → sampel harian (per tanggal, tengah malam)", () => {
    const csv = `${HEADER}\n2026-09-01,8532,2100.5,64,140,70.2,71`;
    const { samples, skipped } = parseGoogleFitDailyCsv(csv);
    expect(skipped).toBe(0);
    const by = Object.fromEntries(samples.map((s) => [s.type, s]));
    expect(by.steps).toMatchObject({ value: 8532, unit: "count", startAt: "2026-09-01T00:00:00", source: "health_connect", externalId: "gfit-steps-2026-09-01" });
    expect(by.active_energy).toMatchObject({ value: 2100.5, unit: "kcal" });
    expect(by.heart_rate!.value).toBe(64);   // AVERAGE, bukan Max 140
    expect(by.weight!.value).toBe(70.2);      // AVERAGE, bukan Max 71
  });
  it("sel kosong dilewati; baris tanpa metrik → skipped", () => {
    const csv = `${HEADER}\n2026-09-01,,,,,,\n2026-09-02,1000,,,,,`;
    const { samples, skipped } = parseGoogleFitDailyCsv(csv);
    expect(samples).toHaveLength(1);          // hanya langkah 2 Sep
    expect(samples[0]).toMatchObject({ type: "steps", value: 1000 });
    expect(skipped).toBe(1);                  // baris 1 Sep tak menghasilkan sampel
  });
  it("tanpa kolom Date → skipped semua baris", () => {
    expect(parseGoogleFitDailyCsv("Step count,Calories\n100,50")).toEqual({ samples: [], skipped: 1 });
  });
  it("auto-deteksi lewat parseWearableImport lalu rollup", () => {
    const csv = `${HEADER}\n2026-09-01,3000,,,,,\n2026-09-01,,,,,,`;
    const { samples } = parseWearableImport(csv);   // header tanpa type&value → jalur Fit
    expect(samples.some((s) => s.type === "steps")).toBe(true);
    const r = rollupDaily(samples);
    expect(r.find((x) => x.type === "steps")).toMatchObject({ day: "2026-09-01", value: 3000 });
  });
});

describe("parseGoogleFitSessionsJson (sesi tidur Takeout)", () => {
  it("sesi tidur → sampel sleep (durasi menit dari start/end)", () => {
    const { samples, skipped } = parseGoogleFitSessionsJson(JSON.stringify({
      fitnessActivity: "sleep", startTime: "2026-09-01T22:30:00.000Z", endTime: "2026-09-02T06:00:00.000Z",
    }));
    expect(skipped).toBe(0);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ type: "sleep", unit: "min", value: 450, source: "health_connect" }); // 7j30m
    expect(samples[0]!.externalId).toContain("gfit-sleep-");
  });
  it("array sesi: non-tidur & waktu invalid dilewati", () => {
    const { samples, skipped } = parseGoogleFitSessionsJson(JSON.stringify([
      { fitnessActivity: "sleep", startTime: "2026-09-01T23:00:00Z", endTime: "2026-09-02T05:00:00Z" },
      { fitnessActivity: "running", startTime: "2026-09-02T06:00:00Z", endTime: "2026-09-02T06:30:00Z" },
      { fitnessActivity: "sleep", startTime: "2026-09-03T05:00:00Z", endTime: "2026-09-03T04:00:00Z" }, // end<start
    ]));
    expect(samples).toHaveLength(1);
    expect(samples[0]!.value).toBe(360);   // 6 jam
    expect(skipped).toBe(2);
  });
  it("auto-deteksi sesi lewat parseWearableImport", () => {
    const { samples } = parseWearableImport(JSON.stringify([
      { fitnessActivity: "sleep", startTime: "2026-09-01T22:00:00Z", endTime: "2026-09-02T05:30:00Z" },
    ]));
    expect(samples[0]).toMatchObject({ type: "sleep", value: 450 });
  });
  it("epoch millis pada startTime/endTime didukung", () => {
    const start = Date.UTC(2026, 8, 1, 22, 0, 0);
    const { samples } = parseGoogleFitSessionsJson(JSON.stringify([
      { fitnessActivity: "sleep", startTime: String(start), endTime: String(start + 8 * 3600 * 1000) },
    ]));
    expect(samples[0]).toMatchObject({ type: "sleep", value: 480 });
  });
  it("segment stage → total sleep + rincian light/deep/rem (awake diabaikan)", () => {
    const { samples } = parseGoogleFitSessionsJson(JSON.stringify({
      fitnessActivity: "sleep", startTime: "2026-09-01T22:00:00Z", endTime: "2026-09-02T06:00:00Z", // 480 mnt
      segment: [
        { fitnessActivity: "sleep.light", startTime: "2026-09-01T22:00:00Z", endTime: "2026-09-01T23:00:00Z" }, // 60
        { fitnessActivity: "sleep.deep", startTime: "2026-09-01T23:00:00Z", endTime: "2026-09-02T01:00:00Z" },  // 120
        { fitnessActivity: "sleep.rem", startTime: "2026-09-02T01:00:00Z", endTime: "2026-09-02T02:00:00Z" },   // 60
        { fitnessActivity: "sleep.awake", startTime: "2026-09-02T02:00:00Z", endTime: "2026-09-02T02:10:00Z" }, // diabaikan
      ],
    }));
    const by = Object.fromEntries(samples.map((s) => [s.type, s.value]));
    expect(by.sleep).toBe(480);
    expect(by.sleep_light).toBe(60);
    expect(by.sleep_deep).toBe(120);
    expect(by.sleep_rem).toBe(60);
    expect(by.sleep_awake).toBeUndefined();
    expect(samples).toHaveLength(4);        // total + 3 stage, awake tak masuk
  });
});
