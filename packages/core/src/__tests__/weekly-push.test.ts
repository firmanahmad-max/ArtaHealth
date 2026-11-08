import { describe, it, expect } from "vitest";
import { weeklyMetrics, buildWeeklyPush, dayStreak, mondayOf } from "../weekly-push.ts";

// 2026-11-15 = Minggu; minggu ini Senin 2026-11-09 … Minggu 2026-11-15; minggu lalu 2–8 Nov.
const SUN = "2026-11-15";

describe("weekly push", () => {
  it("mondayOf: Senin-awal (Minggu masuk minggu yang sama)", () => {
    expect(mondayOf(SUN)).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
  });

  it("dayStreak: berakhir hari ini atau kemarin; putus → 0", () => {
    expect(dayStreak(["2026-11-13", "2026-11-14", "2026-11-15"], SUN)).toBe(3);
    expect(dayStreak(["2026-11-13", "2026-11-14"], SUN)).toBe(2);   // berakhir kemarin
    expect(dayStreak(["2026-11-12", "2026-11-13"], SUN)).toBe(0);   // putus
  });

  it("metrik: hari aktif & catatan minggu ini, hari aktif minggu lalu", () => {
    const m = weeklyMetrics(
      ["2026-11-10", "2026-11-10", "2026-11-12", "2026-11-15", "2026-11-03", "2026-11-01"], // 01 = 2 minggu lalu
      ["2026-11-14", "2026-11-15"], SUN,
    );
    expect(m.recap.activeDays).toBe(3);
    expect(m.recap.totalLogs).toBe(4);
    expect(m.prevActiveDays).toBe(1);
    expect(m.recap.streak).toBe(2);
    expect(m.recap.trend).toBe("up");
  });

  it("hanya Minggu 19:00–20:59", () => {
    const m = weeklyMetrics(["2026-11-14"], [], SUN);
    expect(buildWeeklyPush(m, { todayKey: SUN, hour: 18 })).toBeNull();
    expect(buildWeeklyPush(m, { todayKey: SUN, hour: 21 })).toBeNull();
    expect(buildWeeklyPush(m, { todayKey: "2026-11-14", hour: 19 })).toBeNull(); // Sabtu
    expect(buildWeeklyPush(m, { todayKey: SUN, hour: 19 })).not.toBeNull();
    expect(buildWeeklyPush(m, { todayKey: SUN, hour: 20 })).not.toBeNull();
  });

  it("isi push aktif: hari aktif, catatan, rentetan, headline", () => {
    const m = weeklyMetrics(["2026-11-10", "2026-11-12", "2026-11-14", "2026-11-15"], ["2026-11-14", "2026-11-15"], SUN);
    const p = buildWeeklyPush(m, { todayKey: SUN, hour: 19 })!;
    expect(p.kind).toBe("weekly");
    expect(p.title).toBe("📅 Ringkasan minggu ini");
    expect(p.body).toBe("4/7 hari aktif · 4 catatan · rentetan 2 hari. Konsistensi yang bagus minggu ini. 👏 Lebih aktif dari minggu lalu.");
  });

  it("anti-spam: 2 minggu sepi → tak dikirim; minggu lalu aktif, kini kosong → ajakan lembut", () => {
    expect(buildWeeklyPush(weeklyMetrics(["2026-10-20"], [], SUN), { todayKey: SUN, hour: 19 })).toBeNull();
    const lapsed = buildWeeklyPush(weeklyMetrics(["2026-11-03", "2026-11-05"], [], SUN), { todayKey: SUN, hour: 19 })!;
    expect(lapsed.title).toBe("📅 Minggu ini masih kosong");
    expect(lapsed.body).toContain("Minggu lalu kamu aktif 2 hari");
  });
});
