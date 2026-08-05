import { describe, it, expect } from "vitest";
import { buildReminder, type ReminderOptions } from "../notifications";
import { insightContextSchema } from "../ai/contracts";

const ctx = (over: Record<string, unknown> = {}) =>
  insightContextSchema.parse({ date: "2026-07-22", score: { today: 60 }, ...over });

const at = (hour: number, over: Partial<ReminderOptions> = {}): ReminderOptions => ({ hour, ...over });

describe("buildReminder — push wajib personal atau tidak dikirim", () => {
  it("selalu memuat angka nyata milik user, bukan ajakan generik", () => {
    const r = buildReminder(ctx({ hydration: { totalMl: 800, targetMl: 2500, pct: 32 } }), at(15));
    expect(r).not.toBeNull();
    expect(r!.body).toContain("1,7 liter");   // sisa
    expect(r!.body).toContain("0,8");          // sudah diminum
    expect(r!.body).not.toMatch(/jangan lupa|buka aplikasi/i);
  });

  it("hari tanpa data apa pun → tidak ada notifikasi sama sekali", () => {
    expect(buildReminder(ctx(), at(15))).toBeNull();
    expect(buildReminder(ctx(), at(19))).toBeNull();
  });

  it("target hidrasi tercapai → tidak mengganggu", () => {
    expect(buildReminder(ctx({ hydration: { totalMl: 2500, targetMl: 2500, pct: 100 } }), at(15))).toBeNull();
    // sisa < 250 ml juga tidak layak mengganggu
    expect(buildReminder(ctx({ hydration: { totalMl: 2400, targetMl: 2500, pct: 96 } }), at(15))).toBeNull();
  });

  it("menghormati jam istirahat", () => {
    const c = ctx({ hydration: { totalMl: 500, targetMl: 2500, pct: 20 } });
    expect(buildReminder(c, at(23))).toBeNull();
    expect(buildReminder(c, at(3))).toBeNull();
    expect(buildReminder(c, at(6))).toBeNull();
  });

  it("tidak mengulang kategori yang sudah dikirim hari ini", () => {
    const c = ctx({ hydration: { totalMl: 500, targetMl: 2500, pct: 20 } });
    expect(buildReminder(c, at(15))).not.toBeNull();
    expect(buildReminder(c, at(15, { alreadySentToday: ["hydration"] }))).toBeNull();
  });

  it("hanya satu pengingat per panggilan meski banyak yang kurang", () => {
    const c = ctx({
      hydration: { totalMl: 500, targetMl: 2500, pct: 20 },
      habits: { completed: 1, total: 4 },
      sleep: { durationMin: 360 },
    });
    const r = buildReminder(c, at(18));
    expect(r).not.toBeNull();
    expect(["hydration", "habit", "sleep"]).toContain(r!.kind);
  });

  it("kebiasaan: menyebut progres, tidak menghakimi", () => {
    const r = buildReminder(ctx({ habits: { completed: 2, total: 3 } }), at(19));
    expect(r!.kind).toBe("habit");
    expect(r!.body).toContain("2 dari 3");
    expect(r!.body).not.toMatch(/gagal|tidak disiplin|malas/i);
    // semua selesai → diam
    expect(buildReminder(ctx({ habits: { completed: 3, total: 3 } }), at(19))).toBeNull();
  });

  it("langkah hanya diingatkan bila sisa masih realistis dikejar", () => {
    const jauh = ctx({ activity: { steps: 1000, target: 8000 } });
    expect(buildReminder(jauh, at(17))).toBeNull(); // 7.000 langkah — tidak realistis, menghukum
    const dekat = ctx({ activity: { steps: 6000, target: 8000 } });
    const r = buildReminder(dekat, at(17));
    expect(r!.body).toContain("2.000 langkah");
  });

  it("tidur: hanya bila memang kurang, dan menyebut durasi nyata", () => {
    const r = buildReminder(ctx({ sleep: { durationMin: 360 } }), at(21));
    expect(r!.kind).toBe("sleep");
    expect(r!.body).toContain("6j 0m");
    expect(buildReminder(ctx({ sleep: { durationMin: 480 } }), at(21))).toBeNull();
  });

  it("pengingat selalu punya tujuan buka yang jelas", () => {
    const r = buildReminder(ctx({ hydration: { totalMl: 500, targetMl: 2500, pct: 20 } }), at(15));
    expect(r!.url).toBe("/");
  });
});
