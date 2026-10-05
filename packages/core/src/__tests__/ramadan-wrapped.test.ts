import { describe, it, expect } from "vitest";
import { ramadanWrapped } from "../fasting/ramadan-wrapped.ts";
import type { FastingDayEntry } from "../fasting/streak.ts";

const e = (date: string, status: "fasting" | "not_fasting"): FastingDayEntry => ({ date, status });

describe("ramadanWrapped", () => {
  it("default puasa — tanpa entri, semua hari dihitung puasa (tier penuh)", () => {
    const r = ramadanWrapped({ entries: [], startDate: "2027-02-18", endDate: "2027-02-20" });
    expect(r).toMatchObject({ totalDays: 3, fastedDays: 3, missedDays: 0, longestStreak: 3, completionPct: 100, tier: "penuh" });
    expect(r.headline).toContain("Sebulan penuh");
  });
  it("not_fasting eksplisit mengurangi + memutus rentetan", () => {
    const r = ramadanWrapped({
      entries: [e("2027-02-19", "not_fasting"), e("2027-02-22", "not_fasting")],
      startDate: "2027-02-18", endDate: "2027-02-24", // 7 hari, 2 tak puasa → 5 puasa
    });
    expect(r.totalDays).toBe(7);
    expect(r.fastedDays).toBe(5);
    expect(r.missedDays).toBe(2);
    // rentetan: 18 (1) | 19 miss | 20,21 (2) | 22 miss | 23,24 (2) → terpanjang 2
    expect(r.longestStreak).toBe(2);
    expect(r.completionPct).toBe(71); // 5/7
    expect(r.tier).toBe("baik");
  });
  it("tier kuat (>=80) vs baik (>=50) vs mulai (<50)", () => {
    // 30 hari, 6 tak puasa → 24/30 = 80 → kuat
    const miss6 = Array.from({ length: 6 }, (_, i) => e(`2027-03-0${i + 1}`, "not_fasting"));
    expect(ramadanWrapped({ entries: miss6, startDate: "2027-03-01", endDate: "2027-03-30" }).tier).toBe("kuat");
    // 10 hari, 6 tak puasa → 4/10 = 40 → mulai
    const miss6of10 = Array.from({ length: 6 }, (_, i) => e(`2027-03-0${i + 1}`, "not_fasting"));
    const r = ramadanWrapped({ entries: miss6of10, startDate: "2027-03-01", endDate: "2027-03-10" });
    expect(r.completionPct).toBe(40);
    expect(r.tier).toBe("mulai");
    expect(r.headline).toContain("Setiap langkah dihargai");
  });
  it("entri di luar rentang diabaikan", () => {
    const r = ramadanWrapped({ entries: [e("2027-01-01", "not_fasting")], startDate: "2027-02-18", endDate: "2027-02-19" });
    expect(r.fastedDays).toBe(2); // entri Jan tak berpengaruh
  });
  it("rentang invalid → nol aman", () => {
    expect(ramadanWrapped({ entries: [], startDate: "2027-02-20", endDate: "2027-02-18" }))
      .toMatchObject({ totalDays: 0, completionPct: 0, tier: "mulai" });
  });
});
