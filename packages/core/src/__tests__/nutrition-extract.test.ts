import { describe, it, expect } from "vitest";
import { extractedLabelSchema, sanityCheck, toNutritionInput } from "../nutrition-extract";

const base = {
  serving_size: { value: 250, unit: "ml" as const },
  servings_per_pack: 2,
  net_content: { value: 500, unit: "ml" as const },
  per_serving: { energy_kcal: 90, carb_g: 22, sugar_g: 21, protein_g: 0, fat_g: 0, sodium_mg: 45 },
};

describe("skema ekstraksi label", () => {
  it("menerima JSON label yang valid", () => {
    expect(extractedLabelSchema.safeParse(base).success).toBe(true);
  });
  it("menolak takaran saji ≤ 0 & unit salah", () => {
    expect(extractedLabelSchema.safeParse({ ...base, serving_size: { value: 0, unit: "ml" } }).success).toBe(false);
    expect(extractedLabelSchema.safeParse({ ...base, serving_size: { value: 250, unit: "oz" } }).success).toBe(false);
  });
  it("toleran null pada field opsional (model vision kerap kirim null eksplisit)", () => {
    // GPT-5 mengisi field kosong dengan null → harus lolos (null dibuang→undefined)
    const r = extractedLabelSchema.safeParse({
      ...base, ingredients_raw: null, product_guess: null, net_content: null,
      akg_basis_kcal: null, per_serving: { ...base.per_serving, fiber_g: null },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ingredients_raw).toBeUndefined();
  });
});

describe("validator sanity §3", () => {
  it("label wajar → tidak perlu konfirmasi", () => {
    const r = sanityCheck(base);
    expect(r.needsConfirmation).toBe(false);
    expect(r.issues).toHaveLength(0);
  });

  it("natrium bernilai kecil → tandai kemungkinan satuan g", () => {
    const r = sanityCheck({ ...base, per_serving: { ...base.per_serving, sodium_mg: 2 } });
    expect(r.recheck).toContain("sodium_mg");
    expect(r.issues.some((i) => /natrium/i.test(i.message))).toBe(true);
  });

  it("energi tak konsisten dgn makro (±25%) → tandai", () => {
    // energi 500 tapi makro ≈ 4*22 = 88 → jauh
    const r = sanityCheck({ ...base, per_serving: { ...base.per_serving, energy_kcal: 500 } });
    expect(r.recheck).toContain("energy_kcal");
  });
  it("energi konsisten (dalam toleransi) → tidak ditandai", () => {
    // 4*(22+0)+9*0 = 88; energi 90 → selisih 2% OK
    const r = sanityCheck(base);
    expect(r.recheck).not.toContain("energy_kcal");
  });

  it("gula > karbohidrat → tandai", () => {
    const r = sanityCheck({ ...base, per_serving: { ...base.per_serving, sugar_g: 30, carb_g: 22 } });
    expect(r.issues.some((i) => i.field === "sugar_g")).toBe(true);
  });

  it("lemak jenuh > lemak total → tandai", () => {
    const r = sanityCheck({ ...base, per_serving: { ...base.per_serving, fat_g: 2, sat_fat_g: 5 } });
    expect(r.issues.some((i) => i.field === "sat_fat_g")).toBe(true);
  });

  it("takaran × sajian ≠ isi bersih → tandai", () => {
    const r = sanityCheck({ ...base, servings_per_pack: 3 }); // 250×3=750 vs 500
    expect(r.issues.some((i) => i.field === "servings_per_pack")).toBe(true);
  });

  it("confidence rendah < 0.7 → field masuk recheck", () => {
    const r = sanityCheck({ ...base, confidence: { sugar_g: 0.5, sodium_mg: 0.9 } });
    expect(r.recheck).toContain("sugar_g");
    expect(r.recheck).not.toContain("sodium_mg");
    expect(r.needsConfirmation).toBe(true);
  });
});

describe("toNutritionInput", () => {
  it("memetakan snake_case ekstraksi → input engine (per takaran saji)", () => {
    const input = toNutritionInput(base, "beverage");
    expect(input.serving.sugarG).toBe(21);
    expect(input.serving.sodiumMg).toBe(45);
    expect(input.servingSize).toBe(250);
    expect(input.servingsPerPack).toBe(2);
    expect(input.foodForm).toBe("beverage");
  });
});
