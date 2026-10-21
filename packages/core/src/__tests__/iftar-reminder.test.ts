import { describe, it, expect } from "vitest";
import { buildIftarReminder } from "../fasting/reminders.ts";

// maghrib 18:15 = 1095 menit; offset 30 → jendela [1065, 1095)
describe("buildIftarReminder", () => {
  it("di jendela pra-maghrib → pengingat dgn hitung mundur", () => {
    const r = buildIftarReminder({ nowMinutes: 1080, maghribMinutes: 1095, reminderOffsetMin: 30 })!;
    expect(r.title).toContain("berbuka");
    expect(r.body).toContain("18:15");
    expect(r.body).toContain("15 menit lagi");
    expect(r.url).toBe("/");
  });
  it("sebelum jendela → null", () => {
    expect(buildIftarReminder({ nowMinutes: 1050, maghribMinutes: 1095, reminderOffsetMin: 30 })).toBeNull();
  });
  it("pada/setelah maghrib → null (sudah berbuka)", () => {
    expect(buildIftarReminder({ nowMinutes: 1095, maghribMinutes: 1095, reminderOffsetMin: 30 })).toBeNull();
    expect(buildIftarReminder({ nowMinutes: 1100, maghribMinutes: 1095, reminderOffsetMin: 30 })).toBeNull();
  });
  it("saran hidrasi personal: sisa besar vs kecil", () => {
    const big = buildIftarReminder({ nowMinutes: 1080, maghribMinutes: 1095, reminderOffsetMin: 30, hydration: { totalMl: 500, targetMl: 2500 } })!;
    expect(big.body).toContain("2000 ml");
    const small = buildIftarReminder({ nowMinutes: 1080, maghribMinutes: 1095, reminderOffsetMin: 30, hydration: { totalMl: 2400, targetMl: 2500 } })!;
    expect(small.body).toContain("bertahap agar tak kembung");
  });
});
