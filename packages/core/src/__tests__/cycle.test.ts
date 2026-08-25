import { describe, it, expect } from "vitest";
import { cycleStats, predictCycle, type PeriodLog } from "../cycle.ts";

const DAY = 86_400_000;
const iso = (d: string) => `${d}T00:00:00.000Z`;
/** Deret haid tiap `cycle` hari mulai dari `start`, sebanyak `n`. */
function series(start: string, cycle: number, n: number, lengthDays = 5): PeriodLog[] {
  const base = new Date(iso(start)).getTime();
  return Array.from({ length: n }, (_, i) => ({ startISO: new Date(base + i * cycle * DAY).toISOString(), lengthDays }));
}

describe("cycleStats", () => {
  it("rata-rata siklus & durasi dari interval", () => {
    const s = cycleStats(series("2026-01-01", 30, 4, 6));
    expect(s.avgCycleDays).toBe(30);
    expect(s.avgPeriodDays).toBe(6);
    expect(s.cyclesCounted).toBe(3);
    expect(s.regular).toBe(true);
  });
  it("interval di luar wajar (21–40) diabaikan", () => {
    const p: PeriodLog[] = [
      { startISO: iso("2026-01-01") }, { startISO: iso("2026-01-29") }, // 28
      { startISO: iso("2026-05-01") },                                   // gap besar (log terlewat) → diabaikan
    ];
    expect(cycleStats(p).avgCycleDays).toBe(28);
    expect(cycleStats(p).cyclesCounted).toBe(1);
  });
  it("tanpa riwayat cukup → default 28/5", () => {
    const s = cycleStats([{ startISO: iso("2026-01-01") }]);
    expect(s.avgCycleDays).toBe(28);
    expect(s.avgPeriodDays).toBe(5);
    expect(s.regular).toBe(false);
  });
  it("tak teratur bila variasi besar", () => {
    const p = [
      { startISO: iso("2026-01-01") }, { startISO: iso("2026-01-23") }, // 22
      { startISO: iso("2026-02-27") },                                   // 35
    ];
    expect(cycleStats(p).regular).toBe(false);
  });
});

describe("predictCycle", () => {
  it("kosong → null", () => {
    expect(predictCycle([])).toBeNull();
  });

  it("hari siklus, haid berikutnya, & hitung mundur", () => {
    const periods = series("2026-01-01", 28, 3); // terakhir mulai 2026-02-26
    const now = new Date(iso("2026-03-01")).getTime(); // 3 hari setelah 26 Feb → hari ke-4
    const r = predictCycle(periods, now)!;
    expect(r.cycleLength).toBe(28);
    expect(r.cycleDay).toBe(4);
    expect(r.nextPeriodISO.slice(0, 10)).toBe("2026-03-26");
    expect(r.daysUntilNext).toBe(25);
  });

  it("fase menstruasi di awal siklus", () => {
    const periods = series("2026-01-01", 28, 2, 5); // terakhir 2026-01-29
    const now = new Date(iso("2026-01-31")).getTime(); // hari ke-3 (≤ 5) → menstruasi
    expect(predictCycle(periods, now)!.phase).toBe("menstruation");
  });

  it("fase subur di sekitar ovulasi (hari ~14 utk siklus 28)", () => {
    const periods = series("2026-01-01", 28, 2);
    const ovDay = new Date(iso("2026-01-29")).getTime() + 13 * DAY; // hari ke-14
    const r = predictCycle(periods, ovDay)!;
    expect(r.phase).toBe("fertile");
    expect(r.ovulationISO!.slice(0, 10)).toBe("2026-02-11"); // 29 Jan + 13 hari
  });

  it("telat bila melewati panjang siklus", () => {
    const periods = series("2026-01-01", 28, 2); // terakhir 2026-01-29
    const late = new Date(iso("2026-03-05")).getTime(); // > 28 hari
    const r = predictCycle(periods, late)!;
    expect(r.phase).toBe("late");
    expect(r.daysUntilNext).toBeLessThan(0);
  });

  it("jendela subur terdefinisi & berurutan", () => {
    const r = predictCycle(series("2026-01-01", 28, 2), new Date(iso("2026-02-05")).getTime())!;
    expect(r.fertileWindow).not.toBeNull();
    expect(r.fertileWindow!.startISO < r.fertileWindow!.endISO).toBe(true);
  });
});
