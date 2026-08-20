import { describe, it, expect } from "vitest";
import { identifiedMealSchema, resolveMeal } from "../food-extract.ts";

describe("identifiedMealSchema", () => {
  it("menerima hasil identifikasi valid", () => {
    const r = identifiedMealSchema.safeParse({
      dishes: [{ name: "Nasi goreng", portion_g: 250, confidence: 0.9 }],
      meal_type: "siang",
    });
    expect(r.success).toBe(true);
  });
  it("toleran portion_g string / dibungkus {value} + null (pola vision berantakan)", () => {
    const r = identifiedMealSchema.safeParse({
      dishes: [
        { name: "Ayam goreng", portion_g: "100", confidence: null },
        { name: "Nasi putih", portion_g: { value: 150 } },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.dishes[0]!.portion_g).toBe(100);
      expect(r.data.dishes[1]!.portion_g).toBe(150);
    }
  });
  it("buang entri dish tanpa nama string", () => {
    const r = identifiedMealSchema.safeParse({
      dishes: [{ name: "Tempe goreng" }, { portion_g: 50 }, { name: 123 }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dishes.length).toBe(1);
  });
  it("dishes hilang → default []", () => {
    const r = identifiedMealSchema.safeParse({ meal_type: "camilan" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dishes).toEqual([]);
  });
});

describe("resolveMeal", () => {
  it("petakan hidangan → FOOD_DB + total gizi (porsi AI dipakai)", () => {
    const meal = identifiedMealSchema.parse({
      dishes: [
        { name: "Nasi putih", portion_g: 150 },      // 195 kkal, natrium 2
        { name: "Ayam goreng", portion_g: 100 },       // 250 kkal, natrium 400
      ],
      meal_type: "siang",
    });
    const r = resolveMeal(meal);
    expect(r.items.length).toBe(2);
    expect(r.unresolved).toEqual([]);
    expect(r.total.energyKcal).toBe(445);
    expect(r.total.sodiumMg).toBe(402);
    expect(r.mealType).toBe("siang");
    expect(r.items[0]!.portionSource).toBe("ai");
  });

  it("porsi hilang → pakai porsi lazim FOOD_DB (portionSource=default)", () => {
    const meal = identifiedMealSchema.parse({ dishes: [{ name: "Soto ayam" }] });
    const r = resolveMeal(meal);
    expect(r.items[0]!.portionSource).toBe("default");
    expect(r.items[0]!.portionG).toBe(350); // typicalPortionG soto
  });

  it("hidangan tak dikenal → unresolved, tak masuk total", () => {
    const meal = identifiedMealSchema.parse({
      dishes: [{ name: "Nasi putih", portion_g: 100 }, { name: "Sushi salmon", portion_g: 200 }],
    });
    const r = resolveMeal(meal);
    expect(r.items.length).toBe(1);
    expect(r.unresolved).toEqual(["Sushi salmon"]);
    expect(r.total.energyKcal).toBe(130); // hanya nasi 100g
  });

  it("piring kosong → total nol", () => {
    const r = resolveMeal(identifiedMealSchema.parse({ dishes: [] }));
    expect(r.items.length).toBe(0);
    expect(r.total.energyKcal).toBe(0);
  });
});
