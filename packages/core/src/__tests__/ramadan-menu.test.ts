import { describe, it, expect } from "vitest";
import { ramadanMenuPlan, mealScore } from "../fasting/ramadan-menu.ts";
import { FOOD_DB } from "../food-db.ts";

const ids = (p: ReturnType<typeof ramadanMenuPlan>["sahur"]) => p.items.map((i) => i.food.id);
const food = (id: string) => FOOD_DB.find((f) => f.id === id)!;

describe("ramadanMenuPlan", () => {
  it("deterministik + slot lengkap (sahur 5, berbuka 4), hanya dari FOOD_DB", () => {
    const a = ramadanMenuPlan({ conditions: [], dayIndex: 3 });
    const b = ramadanMenuPlan({ conditions: [], dayIndex: 3 });
    expect(ids(a.sahur)).toEqual(ids(b.sahur));
    expect(a.sahur.items.map((i) => i.role)).toEqual(["Karbohidrat", "Lauk", "Sayur", "Buah", "Minuman"]);
    expect(a.berbuka.items.map((i) => i.role)).toEqual(["Pembuka", "Karbohidrat", "Lauk", "Sayur / sup"]);
    for (const it of [...a.sahur.items, ...a.berbuka.items]) expect(FOOD_DB).toContain(it.food);
  });

  it("variasi harian: menu berganti antar hari", () => {
    const d0 = ids(ramadanMenuPlan({ conditions: [], dayIndex: 0 }).sahur);
    const d1 = ids(ramadanMenuPlan({ conditions: [], dayIndex: 1 }).sahur);
    expect(d1).not.toEqual(d0);
  });

  it("anggaran: tiap makan ≤ 40% & gabungan ≤ 80% jatah harian di semua sumbu, semua kondisi", () => {
    const combos = [[], ["hypertension"], ["diabetes"], ["dyslipidemia"], ["hypertension", "diabetes", "dyslipidemia"]] as const;
    for (const c of combos) for (let d = 0; d < 6; d++) {
      const p = ramadanMenuPlan({ conditions: [...c], dayIndex: d });
      expect(p.sahur.overBudget).toBe(false);
      expect(p.berbuka.overBudget).toBe(false);
      expect(p.used.sodium).toBeLessThanOrEqual(p.budget.sodium * 0.8 + 1);
      expect(p.used.sugar).toBeLessThanOrEqual(p.budget.sugar * 0.8 + 0.1);
      expect(p.used.fat).toBeLessThanOrEqual(p.budget.fat * 0.8 + 0.1);
    }
  });

  it("tak pernah menyarankan gorengan, minuman manis, atau mi instan", () => {
    for (let d = 0; d < 6; d++) {
      const p = ramadanMenuPlan({ conditions: [], dayIndex: d });
      const all = [...ids(p.sahur), ...ids(p.berbuka)];
      for (const bad of ["bakwan", "pisang-goreng", "martabak-manis", "donat", "es-teh-manis", "es-jeruk", "indomie-goreng"]) {
        expect(all).not.toContain(bad);
      }
    }
  });

  it("hipertensi: anggaran natrium 1500 & natrium lebih 'mahal' saat sahur / bagi hipertensi", () => {
    const hyper = ramadanMenuPlan({ conditions: ["hypertension"], dayIndex: 0 });
    expect(hyper.budget.sodium).toBe(1500);
    expect(hyper.used.sodium).toBeLessThanOrEqual(1200);
    // skor: natrium lebih "mahal" saat sahur dan bagi hipertensi
    const rendang = food("rendang");
    expect(mealScore(rendang, "sahur", [])).toBeGreaterThan(mealScore(rendang, "berbuka", []));
    expect(mealScore(rendang, "sahur", ["hypertension"])).toBeGreaterThan(mealScore(rendang, "sahur", []));
  });

  it("exclude dihormati; used = jumlah sahur + berbuka; tip diabetes hanya bila relevan", () => {
    const base = ramadanMenuPlan({ conditions: ["diabetes"], dayIndex: 0 });
    const first = base.sahur.items[0]!.food.id;
    const ex = ramadanMenuPlan({ conditions: ["diabetes"], dayIndex: 0, exclude: [first] });
    expect(ids(ex.sahur)).not.toContain(first);
    expect(base.used.sodium).toBe(Math.round((base.sahur.totals.sodiumMg ?? 0) + (base.berbuka.totals.sodiumMg ?? 0)));
    expect(base.sahur.tips.some((t) => t.includes("penurun gula"))).toBe(true);
    expect(ramadanMenuPlan({ conditions: [], dayIndex: 0 }).sahur.tips.some((t) => t.includes("penurun gula"))).toBe(false);
  });

  it("dayIndex negatif/pecahan aman", () => {
    expect(ids(ramadanMenuPlan({ conditions: [], dayIndex: -2 }).sahur))
      .toEqual(ids(ramadanMenuPlan({ conditions: [], dayIndex: 0 }).sahur));
    expect(ids(ramadanMenuPlan({ conditions: [], dayIndex: 1.7 }).sahur))
      .toEqual(ids(ramadanMenuPlan({ conditions: [], dayIndex: 1 }).sahur));
  });
});
