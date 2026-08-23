import { describe, it, expect } from "vitest";
import {
  computeXp, levelForXp, xpForLevel, earnedBadges, missionStatus, missionBonusXp,
  emptyActivity, XP_RULES, type PlayerActivity,
} from "../gamification.ts";

const act = (p: Partial<PlayerActivity> = {}): PlayerActivity => ({ ...emptyActivity(), ...p });

describe("computeXp", () => {
  it("nol aktivitas → 0 XP (tanpa data tak menghukum)", () => {
    expect(computeXp(emptyActivity())).toBe(0);
  });
  it("menjumlahkan per aturan", () => {
    const a = act({ habitCompletions: 2, hydrationLogs: 3, biomarkerReadings: 1, productScans: 1, currentStreak: 4 });
    // 2*10 + 3*5 + 1*15 + 1*8 + 4*2 = 20+15+15+8+8 = 66
    expect(computeXp(a)).toBe(66);
  });
});

describe("level", () => {
  it("kurva xpForLevel 0/100/300/600/1000", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(5)).toBe(1000);
  });
  it("levelForXp menentukan level + progres", () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(100).level).toBe(2);
    expect(levelForXp(250).level).toBe(2);      // 100..300
    const mid = levelForXp(200);                 // level 2, 100 masuk dari 200 dibutuhkan
    expect(mid.level).toBe(2);
    expect(mid.xpIntoLevel).toBe(100);
    expect(mid.xpForNext).toBe(200);
    expect(mid.progress).toBeCloseTo(0.5, 5);
  });
});

describe("badges", () => {
  it("first_log begitu ada satu aktivitas", () => {
    expect(earnedBadges(act({ hydrationLogs: 1 })).some((b) => b.key === "first_log")).toBe(true);
    expect(earnedBadges(emptyActivity()).some((b) => b.key === "first_log")).toBe(false);
  });
  it("streak & threshold", () => {
    expect(earnedBadges(act({ longestStreak: 7 })).map((b) => b.key)).toContain("streak_7");
    expect(earnedBadges(act({ longestStreak: 6 })).map((b) => b.key)).not.toContain("streak_7");
    expect(earnedBadges(act({ foodLogs: 10 })).map((b) => b.key)).toContain("nutrition_10");
  });
  it("level badge dari XP", () => {
    // level 5 butuh 1000 XP → 100 biomarker × 15 = 1500 XP
    expect(earnedBadges(act({ biomarkerReadings: 100 })).map((b) => b.key)).toContain("level_5");
  });
});

describe("misi harian", () => {
  it("progres & selesai", () => {
    const s = missionStatus({ logs: 3, hydration: 2, habits: 0 });
    const log3 = s.find((x) => x.mission.key === "log3")!;
    expect(log3.done).toBe(true);
    expect(log3.current).toBe(3);
    const hyd = s.find((x) => x.mission.key === "hydrate4")!;
    expect(hyd.done).toBe(false);
    expect(hyd.current).toBe(2);
  });
  it("bonus XP hanya dari misi tuntas", () => {
    expect(missionBonusXp({ logs: 3, hydration: 4, habits: 0 })).toBe(20 + 15); // log3 + hydrate4
    expect(missionBonusXp({ logs: 0, hydration: 0, habits: 0 })).toBe(0);
  });
});

describe("konsistensi XP_RULES", () => {
  it("nilai positif", () => {
    for (const v of Object.values(XP_RULES)) expect(v).toBeGreaterThan(0);
  });
});
