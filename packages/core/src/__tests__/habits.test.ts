import { describe, it, expect } from "vitest";
import { computeStreak, isScheduledOn, isoWeekdayOf, type StreakDay } from "../habits";

const day = (dateKey: string, scheduledCount: number, completedCount: number): StreakDay =>
  ({ dateKey, scheduledCount, completedCount });

describe("isScheduledOn / isoWeekdayOf", () => {
  it("weekday ISO benar", () => {
    expect(isoWeekdayOf("2026-07-20")).toBe(1); // Senin
    expect(isoWeekdayOf("2026-07-19")).toBe(7); // Minggu
  });
  it("jadwal eksplisit dihormati; kosong berarti setiap hari", () => {
    expect(isScheduledOn({ days: [1, 3, 5] }, 3)).toBe(true);
    expect(isScheduledOn({ days: [1, 3, 5] }, 7)).toBe(false);
    expect(isScheduledOn({}, 4)).toBe(true);
    expect(isScheduledOn(null, 4)).toBe(true);
  });
});

describe("computeStreak — desain memaafkan", () => {
  it("hari berurutan dengan centang menambah streak", () => {
    expect(computeStreak([
      day("2026-07-18", 2, 1), day("2026-07-17", 2, 2), day("2026-07-16", 2, 1),
    ])).toBe(3);
  });

  it("hari ini belum dicentang TIDAK memutus — streak kemarin tetap", () => {
    expect(computeStreak([
      day("2026-07-18", 2, 0), day("2026-07-17", 2, 1), day("2026-07-16", 2, 1),
    ])).toBe(2);
  });

  it("bolos kemarin memutus", () => {
    expect(computeStreak([
      day("2026-07-18", 2, 1), day("2026-07-17", 2, 0), day("2026-07-16", 2, 2),
    ])).toBe(1);
  });

  it("hari tanpa jadwal transparan (habit hanya Senin-Rabu-Jumat)", () => {
    expect(computeStreak([
      day("2026-07-18", 1, 1),  // Sabtu terjadwal & selesai
      day("2026-07-17", 0, 0),  // tidak ada jadwal → skip
      day("2026-07-16", 0, 0),  // skip
      day("2026-07-15", 1, 1),  // selesai
    ])).toBe(2);
  });

  it("tanpa data sama sekali → 0", () => {
    expect(computeStreak([])).toBe(0);
    expect(computeStreak([day("2026-07-18", 0, 0)])).toBe(0);
  });
});
