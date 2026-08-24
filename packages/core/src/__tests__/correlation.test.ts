import { describe, it, expect } from "vitest";
import {
  pearson, correlate, findCorrelations, describeCorrelation, type DailyMetricPoint,
} from "../correlation.ts";

const day = (i: number) => `2026-08-${String(i + 1).padStart(2, "0")}`;
const series = (vals: number[]): DailyMetricPoint[] => vals.map((v, i) => ({ day: day(i), value: v }));

describe("pearson", () => {
  it("korelasi positif sempurna = 1", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
  });
  it("korelasi negatif sempurna = -1", () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 5);
  });
  it("varians nol → null", () => {
    expect(pearson([5, 5, 5], [1, 2, 3])).toBeNull();
  });
  it("n<2 → null", () => {
    expect(pearson([1], [2])).toBeNull();
  });
});

describe("correlate", () => {
  it("memasangkan berdasarkan hari yang sama & hormati minPairs", () => {
    const a = series([1, 2, 3, 4, 5, 6, 7, 8]);
    const b = series([2, 4, 6, 8, 10, 12, 14, 16]);
    const c = correlate(a, b, "sleep", "mood", 8)!;
    expect(c).not.toBeNull();
    expect(c.n).toBe(8);
    expect(c.r).toBeCloseTo(1, 5);
    expect(c.direction).toBe("positive");
    expect(c.strength).toBe("strong");
  });
  it("pasangan kurang dari minPairs → null", () => {
    expect(correlate(series([1, 2, 3]), series([1, 2, 3]), "a", "b", 8)).toBeNull();
  });
  it("hanya hari beririsan yang dipakai", () => {
    const a = [{ day: "2026-08-01", value: 1 }, { day: "2026-08-02", value: 2 }, { day: "2026-08-03", value: 3 }];
    const b = [{ day: "2026-08-02", value: 2 }, { day: "2026-08-03", value: 3 }]; // hanya 2 & 3
    const c = correlate(a, b, "a", "b", 2)!;
    expect(c.n).toBe(2);
  });
});

describe("findCorrelations", () => {
  it("mengembalikan pasangan di atas ambang, urut |r|, dibatasi top", () => {
    const s = {
      sleep: series([6, 7, 8, 5, 9, 6, 7, 8, 6, 7]),
      mood: series([3, 4, 5, 2, 5, 3, 4, 5, 3, 4]),       // sangat searah dgn sleep
      hydration: series([2, 1, 2, 1, 2, 1, 2, 1, 2, 1]),  // acak vs sleep
    };
    const res = findCorrelations(s, { minPairs: 8, minAbsR: 0.4, top: 3 });
    expect(res.length).toBeGreaterThanOrEqual(1);
    // pasangan terkuat = sleep×mood
    expect([res[0]!.a, res[0]!.b].sort()).toEqual(["mood", "sleep"]);
    expect(res[0]!.direction).toBe("positive");
  });
  it("tak ada yang lolos ambang → kosong", () => {
    const s = {
      a: series([1, 5, 2, 8, 3, 9, 1, 6, 2, 7]),
      b: series([9, 1, 8, 2, 7, 1, 9, 2, 8, 1]),
    };
    // paksa ambang sangat tinggi
    expect(findCorrelations(s, { minAbsR: 0.99, minPairs: 8, top: 3 })).toEqual([]);
  });
});

describe("describeCorrelation", () => {
  it("narasi pola non-kausal", () => {
    const c = { a: "sleep", b: "mood", r: 0.8, n: 12, strength: "strong" as const, direction: "positive" as const };
    const s = describeCorrelation(c, { sleep: "durasi tidur", mood: "mood" });
    expect(s).toContain("durasi tidur");
    expect(s).toContain("cenderung lebih tinggi");
    expect(s).toContain("pola kuat");
    expect(s).toContain("12 hari");
  });
});
