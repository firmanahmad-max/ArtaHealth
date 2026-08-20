/**
 * Food Diary AI — engine estimasi DETERMINISTIK (Fase 6 #5). AI mengidentifikasi
 * hidangan + porsi; DI SINI gizi dihitung = per100g × porsi dari FOOD_DB (TKPI).
 * Tidak ada tebakan angka oleh AI. Juga Perencana Menu: saran hidangan yang muat
 * di sisa anggaran GGL harian (memakai GGL_BUDGET Sadar Gizi).
 *
 * ⚠️ Nilai FOOD_DB kerangka (lihat food-db.ts) — estimasi, bukan pengukuran. UI wajib
 *    "perkiraan" + izinkan koreksi porsi/hidangan sebelum masuk food_logs.
 */

import { FOOD_DB, type FoodItem } from "./food-db.ts";
import { GGL_BUDGET, type ServingNutrients } from "./nutrition.ts";

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Cocokkan hasil identifikasi AI (nama hidangan) ke FOOD_DB. Prioritas:
 *  1) cocok persis nama/alias, 2) nama muncul di dalam frasa query (ambil terpanjang),
 *  3) query bagian dari nama (ambil terpendek/paling spesifik). null bila tak ada.
 */
export function findFood(query: string): FoodItem | null {
  const q = norm(query ?? "");
  if (!q) return null;
  let exact: FoodItem | null = null;
  let contained: { food: FoodItem; len: number } | null = null; // query berisi term
  let prefixOf: { food: FoodItem; len: number } | null = null;   // term berisi query
  for (const food of FOOD_DB) {
    for (const raw of [food.name, ...(food.aliases ?? [])]) {
      const t = norm(raw);
      if (q === t) { exact = food; break; }
      if (q.includes(t) && (!contained || t.length > contained.len)) contained = { food, len: t.length };
      if (t.includes(q) && (!prefixOf || t.length < prefixOf.len)) prefixOf = { food, len: t.length };
    }
    if (exact) break;
  }
  return exact ?? contained?.food ?? prefixOf?.food ?? null;
}

/** Gizi satu hidangan pada porsi tertentu (gram) → ServingNutrients (dipakai GGL Budget). */
export function estimateNutrition(food: FoodItem, portionG: number): ServingNutrients {
  const k = Math.max(0, portionG) / 100;
  const p = food.per100g;
  const r = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * k * 10) / 10);
  return {
    energyKcal: r(p.energyKcal), carbG: r(p.carbG), proteinG: r(p.proteinG),
    totalFatG: r(p.fatG), satFatG: r(p.satFatG), sugarG: r(p.sugarG),
    sodiumMg: p.sodiumMg === undefined ? undefined : Math.round(p.sodiumMg * k),
    fiberG: r(p.fiberG),
  };
}

/** Satu komponen piring: hidangan + porsi. */
export interface PlateItem { food: FoodItem; portionG: number }

/** Jumlahkan beberapa hidangan (satu piring) → total ServingNutrients. */
export function estimatePlate(items: PlateItem[]): ServingNutrients {
  const acc = { energyKcal: 0, sugarG: 0, sodiumMg: 0, totalFatG: 0, satFatG: 0, carbG: 0, proteinG: 0, fiberG: 0 };
  for (const it of items) {
    const n = estimateNutrition(it.food, it.portionG);
    acc.energyKcal += n.energyKcal ?? 0; acc.sugarG += n.sugarG ?? 0; acc.sodiumMg += n.sodiumMg ?? 0;
    acc.totalFatG += n.totalFatG ?? 0; acc.satFatG += n.satFatG ?? 0; acc.carbG += n.carbG ?? 0;
    acc.proteinG += n.proteinG ?? 0; acc.fiberG += n.fiberG ?? 0;
  }
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    energyKcal: round(acc.energyKcal), sugarG: round(acc.sugarG), sodiumMg: Math.round(acc.sodiumMg),
    totalFatG: round(acc.totalFatG), satFatG: round(acc.satFatG), carbG: round(acc.carbG),
    proteinG: round(acc.proteinG), fiberG: round(acc.fiberG),
  };
}

// ===== Perencana Menu (sisa anggaran GGL) =====

/** Dampak GGL satu hidangan pada porsi lazim. */
export interface MealSuggestion {
  food: FoodItem;
  portionG: number;
  impact: { sugar: number; sodium: number; fat: number };
}

const gglImpact = (food: FoodItem, portionG: number) => {
  const k = portionG / 100;
  return {
    sugar: Math.round((food.per100g.sugarG ?? 0) * k * 10) / 10,
    sodium: Math.round((food.per100g.sodiumMg ?? 0) * k),
    fat: Math.round((food.per100g.fatG ?? 0) * k * 10) / 10,
  };
};

/**
 * Saran hidangan yang MUAT di sisa anggaran GGL (ketiga sumbu ≤ sisa).
 * Personalisasi: bila hipertensi, prioritaskan natrium rendah. Diurutkan teringan dulu.
 */
export function suggestMeals(
  remaining: { sugar: number; sodium: number; fat: number },
  opts?: { limit?: number; hypertension?: boolean; category?: FoodItem["category"] },
): MealSuggestion[] {
  const limit = opts?.limit ?? 6;
  const budget = { sugar: GGL_BUDGET.sugar, sodium: GGL_BUDGET.sodium, fat: GGL_BUDGET.fat };
  const fits: MealSuggestion[] = [];
  for (const food of FOOD_DB) {
    if (opts?.category && food.category !== opts.category) continue;
    const impact = gglImpact(food, food.typicalPortionG);
    if (impact.sugar <= remaining.sugar && impact.sodium <= remaining.sodium && impact.fat <= remaining.fat) {
      fits.push({ food, portionG: food.typicalPortionG, impact });
    }
  }
  const frac = (m: MealSuggestion) =>
    (opts?.hypertension ? m.impact.sodium / budget.sodium * 2 : 0) +
    m.impact.sugar / budget.sugar + m.impact.sodium / budget.sodium + m.impact.fat / budget.fat;
  return fits.sort((a, b) => frac(a) - frac(b)).slice(0, limit);
}
