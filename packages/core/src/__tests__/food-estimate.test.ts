import { describe, it, expect } from "vitest";
import { findFood, estimateNutrition, estimatePlate, suggestMeals } from "../food-estimate.ts";
import { FOOD_DB } from "../food-db.ts";

const byId = (id: string) => FOOD_DB.find((f) => f.id === id)!;

describe("findFood", () => {
  it("cocok persis nama/alias", () => {
    expect(findFood("nasi")?.id).toBe("nasi-putih");        // alias "nasi"
    expect(findFood("Nasi goreng")?.id).toBe("nasi-goreng");
  });
  it("nama muncul di frasa panjang → ambil paling spesifik", () => {
    expect(findFood("sepiring nasi goreng ayam pedas")?.id).toBe("nasi-goreng");
    expect(findFood("ayam goreng kremes")?.id).toBe("ayam-goreng");
  });
  it("case-insensitive & spasi ganda", () => {
    expect(findFood("  SOTO   AYAM ")?.id).toBe("soto-ayam");
  });
  it("tak dikenal → null", () => {
    expect(findFood("pizza pepperoni")).toBeNull();
    expect(findFood("")).toBeNull();
  });
});

describe("estimateNutrition", () => {
  it("skala per100g × porsi", () => {
    const nasi = byId("nasi-putih"); // 130 kkal, 28 karbo, 1 mg natrium /100g
    const n = estimateNutrition(nasi, 150);
    expect(n.energyKcal).toBe(195);      // 130 × 1.5
    expect(n.carbG).toBe(42);            // 28 × 1.5
    expect(n.sodiumMg).toBe(2);          // 1 × 1.5 → 1.5 → 2 (round)
  });
  it("porsi 0/negatif → nol", () => {
    const n = estimateNutrition(byId("nasi-goreng"), -5);
    expect(n.energyKcal).toBe(0);
    expect(n.sodiumMg).toBe(0);
  });
});

describe("estimatePlate", () => {
  it("menjumlahkan beberapa hidangan", () => {
    const plate = estimatePlate([
      { food: byId("nasi-putih"), portionG: 150 }, // 195 kkal, natrium 2
      { food: byId("ayam-goreng"), portionG: 100 }, // 250 kkal, natrium 400
      { food: byId("tumis-kangkung"), portionG: 100 }, // 70 kkal, natrium 400
    ]);
    expect(plate.energyKcal).toBe(515);   // 195+250+70
    expect(plate.sodiumMg).toBe(802);     // 2+400+400
  });
});

describe("suggestMeals (Perencana Menu)", () => {
  it("hanya hidangan yang MUAT di sisa anggaran (ketiga sumbu)", () => {
    // sisa ketat: gula 5g, natrium 100mg, lemak 5g
    const s = suggestMeals({ sugar: 5, sodium: 100, fat: 5 });
    expect(s.length).toBeGreaterThan(0);
    for (const m of s) {
      expect(m.impact.sugar).toBeLessThanOrEqual(5);
      expect(m.impact.sodium).toBeLessThanOrEqual(100);
      expect(m.impact.fat).toBeLessThanOrEqual(5);
    }
  });
  it("anggaran habis → tak ada saran", () => {
    expect(suggestMeals({ sugar: 0, sodium: 0, fat: 0 }).length).toBe(0);
  });
  it("hipertensi → saran rata-rata lebih rendah natrium (vs tanpa)", () => {
    const full = { sugar: 50, sodium: 2000, fat: 67 };
    const withH = suggestMeals(full, { hypertension: true, limit: 5 });
    const noH = suggestMeals(full, { limit: 5 });
    const avgNa = (a: typeof withH) => a.reduce((s, m) => s + m.impact.sodium, 0) / a.length;
    expect(withH.length).toBeGreaterThan(0);
    expect(avgNa(withH)).toBeLessThanOrEqual(avgNa(noH));
  });
  it("filter kategori", () => {
    const s = suggestMeals({ sugar: 50, sodium: 2000, fat: 67 }, { category: "buah", limit: 10 });
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((m) => m.food.category === "buah")).toBe(true);
  });
});

describe("FOOD_DB integritas", () => {
  it("id unik & porsi positif", () => {
    const ids = FOOD_DB.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FOOD_DB) {
      expect(f.typicalPortionG).toBeGreaterThan(0);
      expect(f.per100g.energyKcal).toBeGreaterThanOrEqual(0);
    }
  });
});
