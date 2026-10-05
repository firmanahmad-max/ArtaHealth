import { describe, it, expect } from "vitest";
import { ramadanReadiness, type RamadanReadinessInput } from "../fasting/ramadan-readiness.ts";

const base: RamadanReadinessInput = {
  daysUntilStart: 30, hasLocation: false, medicalAcknowledged: false,
  medicationModuleOn: false, hasMedications: false,
};

describe("ramadanReadiness", () => {
  it("item obat hanya saat modul aktif", () => {
    expect(ramadanReadiness(base).items.map((i) => i.id)).toEqual(["location", "medical"]);
    expect(ramadanReadiness({ ...base, medicationModuleOn: true }).items.map((i) => i.id))
      .toEqual(["location", "medical", "medication"]);
  });
  it("hitung ready + headline sisa langkah", () => {
    const r = ramadanReadiness({ ...base, hasLocation: true });
    expect(r).toMatchObject({ readyCount: 1, totalCount: 2, allReady: false });
    expect(r.headline).toContain("1 langkah lagi");
  });
  it("semua siap → headline sambutan", () => {
    const r = ramadanReadiness({ ...base, hasLocation: true, medicalAcknowledged: true });
    expect(r.allReady).toBe(true);
    expect(r.headline).toContain("Semua siap");
  });
  it("modul obat: obat terdaftar terhitung done", () => {
    const r = ramadanReadiness({ ...base, hasLocation: true, medicalAcknowledged: true, medicationModuleOn: true, hasMedications: true });
    expect(r.readyCount).toBe(3);
    expect(r.allReady).toBe(true);
  });
  it("daysUntilStart di-clamp non-negatif & dibulatkan", () => {
    expect(ramadanReadiness({ ...base, daysUntilStart: -5 }).daysUntilStart).toBe(0);
    expect(ramadanReadiness({ ...base, daysUntilStart: 12.6 }).daysUntilStart).toBe(13);
  });
});
