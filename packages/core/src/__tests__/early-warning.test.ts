import { describe, it, expect } from "vitest";
import { baselineOf, detectEarlyWarning, DEFAULT_EW_CONFIG, type EWPoint } from "../early-warning.ts";

const NOW = Date.parse("2026-08-23T00:00:00Z");
const DAY = 86_400_000;
/** Titik `d` hari yang lalu dengan nilai v. */
const ago = (d: number, v: number): EWPoint => ({ t: new Date(NOW - d * DAY).toISOString(), value: v });

/** Deret baseline stabil sekitar `mean±jitter` untuk hari [start..end] lampau. */
function stable(startDaysAgo: number, endDaysAgo: number, base: number): EWPoint[] {
  const pts: EWPoint[] = [];
  for (let d = startDaysAgo; d >= endDaysAgo; d--) {
    // jitter deterministik kecil ±1 agar sd>0
    pts.push(ago(d, base + (d % 2 === 0 ? 1 : -1)));
  }
  return pts;
}

describe("baselineOf", () => {
  it("mean & sd sampel", () => {
    const b = baselineOf([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(b.n).toBe(8);
    expect(b.mean).toBe(5);
    expect(b.sd).toBeCloseTo(2.138, 2); // sd sampel
  });
  it("n<2 → sd 0", () => {
    expect(baselineOf([]).sd).toBe(0);
    expect(baselineOf([7]).sd).toBe(0);
  });
});

describe("detectEarlyWarning — gate data", () => {
  it("baseline kurang dari minimum → insufficient", () => {
    const pts = [ago(20, 70), ago(19, 71), ago(3, 72), ago(2, 72), ago(1, 73)];
    const r = detectEarlyWarning(pts, NOW);
    expect(r.status).toBe("insufficient");
    expect(r.severity).toBe("none");
  });
  it("recent kurang dari minimum → insufficient", () => {
    const pts = [...stable(40, 10, 70), ago(1, 90)]; // baseline cukup, recent cuma 1
    const r = detectEarlyWarning(pts, NOW);
    expect(r.status).toBe("insufficient");
    expect(r.recentN).toBe(1);
  });
});

describe("detectEarlyWarning — deteksi", () => {
  it("stabil → normal", () => {
    const pts = [...stable(40, 8, 70), ago(5, 70), ago(3, 71), ago(1, 69)];
    const r = detectEarlyWarning(pts, NOW);
    expect(r.status).toBe("normal");
    expect(r.baselineN).toBeGreaterThanOrEqual(DEFAULT_EW_CONFIG.minBaseline);
  });

  it("kenaikan berkelanjutan → anomaly rising", () => {
    // baseline ~70 (jitter ±1), terkini melonjak ke ~80
    const pts = [...stable(40, 8, 70), ago(6, 80), ago(4, 81), ago(2, 80), ago(1, 79)];
    const r = detectEarlyWarning(pts, NOW);
    expect(r.status).toBe("anomaly");
    expect(r.direction).toBe("rising");
    expect(r.z!).toBeGreaterThanOrEqual(DEFAULT_EW_CONFIG.watchZ);
    expect(["watch", "alert"]).toContain(r.severity);
    expect(r.delta!).toBeGreaterThan(0);
  });

  it("penurunan besar → anomaly falling + alert", () => {
    const pts = [...stable(40, 8, 70), ago(6, 40), ago(4, 41), ago(2, 39), ago(1, 40)];
    const r = detectEarlyWarning(pts, NOW);
    expect(r.status).toBe("anomaly");
    expect(r.direction).toBe("falling");
    expect(r.severity).toBe("alert");
    expect(r.z!).toBeLessThanOrEqual(-DEFAULT_EW_CONFIG.alertZ);
  });

  it("ambang watch vs alert dari |z|", () => {
    const base = stable(40, 8, 100); // sd ~1
    const b = baselineOf(base.map((p) => p.value));
    // dorong recent ~ mean + 2.5*sd → watch (≥2, <3)
    const target = b.mean + 2.5 * b.sd;
    const watch = detectEarlyWarning([...base, ago(3, target), ago(2, target), ago(1, target)], NOW);
    expect(watch.severity).toBe("watch");
    // ~ mean + 4*sd → alert
    const t2 = b.mean + 4 * b.sd;
    const alert = detectEarlyWarning([...base, ago(3, t2), ago(2, t2), ago(1, t2)], NOW);
    expect(alert.severity).toBe("alert");
  });

  it("baseline datar (sd=0): geseran apa pun → alert; sama → normal", () => {
    const flat: EWPoint[] = [];
    for (let d = 40; d >= 8; d--) flat.push(ago(d, 50)); // semua 50 → sd 0
    const shifted = detectEarlyWarning([...flat, ago(3, 55), ago(2, 55), ago(1, 55)], NOW);
    expect(shifted.status).toBe("anomaly");
    expect(shifted.severity).toBe("alert");
    expect(shifted.z).toBeNull();
    const same = detectEarlyWarning([...flat, ago(3, 50), ago(2, 50), ago(1, 50)], NOW);
    expect(same.status).toBe("normal");
  });

  it("abaikan nilai/tanggal invalid", () => {
    const pts = [...stable(40, 8, 70), { t: "bukan-tanggal", value: 999 }, { t: new Date(NOW).toISOString(), value: NaN }, ago(2, 70), ago(1, 71), ago(3, 70)];
    const r = detectEarlyWarning(pts, NOW);
    expect(r.status).toBe("normal"); // titik sampah tak menggeser hasil
  });
});
