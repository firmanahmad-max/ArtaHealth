import { describe, it, expect } from "vitest";
import { weeklyRecap } from "../weekly-recap.ts";

describe("weeklyRecap", () => {
  it("headline per tingkat konsistensi", () => {
    expect(weeklyRecap({ activeDays: 0, totalLogs: 0, prevActiveDays: 0, currentStreak: 0 }).headline)
      .toBe("Yuk mulai catat satu hal minggu ini.");
    expect(weeklyRecap({ activeDays: 1, totalLogs: 1, prevActiveDays: 1, currentStreak: 1 }).headline)
      .toContain("Awal yang baik");
    expect(weeklyRecap({ activeDays: 3, totalLogs: 5, prevActiveDays: 3, currentStreak: 3 }).headline)
      .toContain("Momentum");
    expect(weeklyRecap({ activeDays: 6, totalLogs: 12, prevActiveDays: 6, currentStreak: 6 }).headline)
      .toContain("luar biasa konsisten");
  });
  it("tren naik/turun ditambahkan (bila ada aktivitas)", () => {
    expect(weeklyRecap({ activeDays: 5, totalLogs: 9, prevActiveDays: 2, currentStreak: 5 }).trend).toBe("up");
    expect(weeklyRecap({ activeDays: 5, totalLogs: 9, prevActiveDays: 2, currentStreak: 5 }).headline)
      .toContain("Lebih aktif dari minggu lalu");
    expect(weeklyRecap({ activeDays: 2, totalLogs: 3, prevActiveDays: 5, currentStreak: 0 }).trend).toBe("down");
    expect(weeklyRecap({ activeDays: 2, totalLogs: 3, prevActiveDays: 5, currentStreak: 0 }).headline)
      .toContain("ayo kejar");
  });
  it("tren flat tak menambah kalimat; 0 hari tak dapat embel tren", () => {
    expect(weeklyRecap({ activeDays: 4, totalLogs: 6, prevActiveDays: 4, currentStreak: 4 }).headline)
      .toBe("Konsistensi yang bagus minggu ini. 👏");
    expect(weeklyRecap({ activeDays: 0, totalLogs: 0, prevActiveDays: 3, currentStreak: 0 }).headline)
      .toBe("Yuk mulai catat satu hal minggu ini.");
  });
  it("clamp & round nilai di luar rentang", () => {
    const r = weeklyRecap({ activeDays: 9, totalLogs: 12.6, prevActiveDays: -2, currentStreak: 3.4 });
    expect(r.activeDays).toBe(7);
    expect(r.totalLogs).toBe(13);
    expect(r.streak).toBe(3);
    expect(r.trend).toBe("up");
  });
});
