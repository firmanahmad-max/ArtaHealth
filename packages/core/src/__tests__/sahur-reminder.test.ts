import { describe, it, expect } from "vitest";
import { buildSahurReminder } from "../fasting/reminders";

// imsak 04:39 = 279 menit; offset 60 → jendela [219, 279)
const IMSAK = 279;

describe("pengingat sahur (deterministik)", () => {
  it("null di luar jendela pra-imsak", () => {
    expect(buildSahurReminder({ nowMinutes: 218, imsakMinutes: IMSAK, reminderOffsetMin: 60 })).toBeNull(); // sebelum jendela
    expect(buildSahurReminder({ nowMinutes: 279, imsakMinutes: IMSAK, reminderOffsetMin: 60 })).toBeNull(); // tepat imsak → lewat
    expect(buildSahurReminder({ nowMinutes: 600, imsakMinutes: IMSAK, reminderOffsetMin: 60 })).toBeNull(); // siang
  });

  it("aktif di dalam jendela, menyebut waktu imsak & menit tersisa", () => {
    const r = buildSahurReminder({ nowMinutes: 219, imsakMinutes: IMSAK, reminderOffsetMin: 60 });
    expect(r).not.toBeNull();
    expect(r!.title).toContain("sahur");
    expect(r!.body).toContain("04:39");
    expect(r!.body).toContain("60 menit lagi");
  });

  it("menit tersisa dihitung dinamis dari waktu sekarang", () => {
    const r = buildSahurReminder({ nowMinutes: 264, imsakMinutes: IMSAK, reminderOffsetMin: 60 });
    expect(r!.body).toContain("15 menit lagi"); // 279 − 264
  });

  it("menyertakan sisa target air bila masih kurang ≥250 ml", () => {
    const r = buildSahurReminder({
      nowMinutes: 219, imsakMinutes: IMSAK, reminderOffsetMin: 60,
      hydration: { totalMl: 1750, targetMl: 2500 },
    });
    expect(r!.body).toContain("750 ml");
    expect(r!.body).toMatch(/2 gelas|berprotein/);
  });

  it("bila target air hampir/ sudah tercapai → saran menu saja, tanpa angka air", () => {
    const r = buildSahurReminder({
      nowMinutes: 219, imsakMinutes: IMSAK, reminderOffsetMin: 60,
      hydration: { totalMl: 2400, targetMl: 2500 },
    });
    expect(r!.body).not.toMatch(/\d+ ml/);
    expect(r!.body).toMatch(/berprotein/);
  });

  it("offset yang berbeda menggeser awal jendela", () => {
    // offset 30 → jendela [249, 279); now 240 di luar
    expect(buildSahurReminder({ nowMinutes: 240, imsakMinutes: IMSAK, reminderOffsetMin: 30 })).toBeNull();
    expect(buildSahurReminder({ nowMinutes: 250, imsakMinutes: IMSAK, reminderOffsetMin: 30 })).not.toBeNull();
  });
});
