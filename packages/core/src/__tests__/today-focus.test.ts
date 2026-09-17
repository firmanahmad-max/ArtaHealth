import { describe, it, expect } from "vitest";
import { todayFocus, type TodayFocusInput } from "../today-focus.ts";

const base: TodayFocusInput = {
  loggedToday: { hydration: true, sleep: true, mood: true, activity: true },
  hydrationMl: 2500, hydrationTargetMl: 2500,
  currentStreak: 0, streakActiveToday: true, scoreReady: true, totalLogsToday: 4,
};

describe("todayFocus", () => {
  it("rentetan di ambang putus jadi prioritas teratas", () => {
    const r = todayFocus({ ...base, currentStreak: 5, streakActiveToday: false, loggedToday: { hydration: false, sleep: false, mood: false, activity: false } });
    expect(r[0]!.id).toBe("streak");
    expect(r[0]!.title).toContain("5 hari");
  });
  it("belum siap skor → item aktivasi (sisa yg perlu dicatat)", () => {
    const r = todayFocus({ ...base, scoreReady: false, totalLogsToday: 1 });
    const item = r.find((x) => x.id === "first-score")!;
    expect(item.title).toContain("2 hal lagi");
  });
  it("log inti yang belum → satu item ringkas berisi jenis yang kurang", () => {
    const r = todayFocus({ ...base, loggedToday: { hydration: true, sleep: false, mood: false, activity: true } });
    const item = r.find((x) => x.id === "log-core")!;
    expect(item.title).toContain("tidur");
    expect(item.title).toContain("mood");
    expect(item.title).not.toContain("aktivitas");
  });
  it("kekurangan hidrasi → hitung gelas dari selisih target", () => {
    const r = todayFocus({ ...base, hydrationMl: 1000, hydrationTargetMl: 2500 }); // selisih 1500 → 6 gelas
    const item = r.find((x) => x.id === "hydration-gap")!;
    expect(item.title).toContain("6 gelas");
  });
  it("semua inti lengkap & target tercapai → rayakan", () => {
    const r = todayFocus(base);
    expect(r).toEqual([expect.objectContaining({ id: "all-done", tone: "celebrate" })]);
  });
  it("maksimal 3 item, urut prioritas turun", () => {
    const r = todayFocus({
      loggedToday: { hydration: true, sleep: false, mood: false, activity: false },
      hydrationMl: 500, hydrationTargetMl: 2500,
      currentStreak: 3, streakActiveToday: false, scoreReady: true, totalLogsToday: 1,
    });
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r[0]!.id).toBe("streak");
    expect(r.map((x) => x.priority)).toEqual([...r.map((x) => x.priority)].sort((a, b) => b - a));
  });
});
