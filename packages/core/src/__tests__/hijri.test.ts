import { describe, it, expect } from "vitest";
import { gregorianToHijri, formatHijri, sunnahFastingOn } from "../fasting/hijri";

describe("konversi Hijriah tabular", () => {
  it("menghasilkan tanggal yang valid (bulan 1–12, hari 1–30)", () => {
    for (const [y, m, d] of [[2026, 8, 13], [2027, 2, 18], [2000, 1, 1], [2023, 7, 19]] as const) {
      const h = gregorianToHijri(y, m, d);
      expect(h.month).toBeGreaterThanOrEqual(1);
      expect(h.month).toBeLessThanOrEqual(12);
      expect(h.day).toBeGreaterThanOrEqual(1);
      expect(h.day).toBeLessThanOrEqual(30);
      console.log(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} → ${formatHijri(h)}`);
    }
  });

  it("hari Gregorian berurutan → Hijriah maju tepat satu hari (dengan pergantian bulan)", () => {
    let prev = gregorianToHijri(2026, 8, 1);
    for (let d = 2; d <= 31; d++) {
      const cur = gregorianToHijri(2026, 8, d);
      const advancedInMonth = cur.day === prev.day + 1 && cur.month === prev.month;
      const rolledMonth = cur.day === 1 && (prev.day === 29 || prev.day === 30);
      expect(advancedInMonth || rolledMonth, `dari ${formatHijri(prev)} ke ${formatHijri(cur)}`).toBe(true);
      prev = cur;
    }
  });

  it("anchor: Ramadan 1448 jatuh di sekitar Feb 2027 (toleransi tabular ±2 hari)", () => {
    const h = gregorianToHijri(2027, 2, 20);
    expect(h.year).toBe(1448);
    expect(h.month).toBe(9); // Ramadan
  });
});

describe("deteksi hari puasa sunnah §3.2", () => {
  it("Senin/Kamis terdeteksi dari weekday", () => {
    // 2026-08-13 = Kamis (ISO 4)
    expect(sunnahFastingOn(2026, 8, 13, 4, ["senin_kamis"])).toContain("senin_kamis");
    expect(sunnahFastingOn(2026, 8, 13, 3, ["senin_kamis"])).toHaveLength(0); // Rabu
  });

  it("hanya jadwal yang dipilih user yang dicek", () => {
    expect(sunnahFastingOn(2026, 8, 13, 1, ["ayyamul_bidh"])).toHaveLength(0); // Senin tapi tak pilih senin_kamis
  });

  it("Ayyamul Bidh saat tanggal Hijriah 13–15", () => {
    // cari tanggal Gregorian yang Hijriah-nya hari ke-14
    let found = false;
    for (let d = 1; d <= 31; d++) {
      const h = gregorianToHijri(2026, 8, d);
      const hits = sunnahFastingOn(2026, 8, d, 1, ["ayyamul_bidh"]);
      if (h.day >= 13 && h.day <= 15) { expect(hits).toContain("ayyamul_bidh"); found = true; }
      else expect(hits).toHaveLength(0);
    }
    expect(found).toBe(true);
  });
});
