/**
 * Food Diary AI — kontrak identifikasi hidangan (Fase 6 · FD-2) + resolusi ke gizi.
 * Vision HANYA mengidentifikasi hidangan + perkiraan porsi (bukan menebak angka gizi);
 * gizi dihitung DETERMINISTIK di `resolveMeal` via FOOD_DB (TKPI). Pola sama Sadar Gizi.
 *
 * ⚠️ Ini ESTIMASI (foto masakan < akurasi label). UI wajib "perkiraan" + koreksi porsi.
 */

import { z } from "zod";
import { stripNulls, looseNumber } from "./nutrition-extract.ts";
import { findFood, estimatePlate, type PlateItem } from "./food-estimate.ts";
import type { FoodItem } from "./food-db.ts";
import type { ServingNutrients } from "./nutrition.ts";

const loose = (schema: z.ZodTypeAny) => z.preprocess(looseNumber, schema);

const dishSchema = z.object({
  name: z.string().min(1),
  /** perkiraan porsi gram (opsional; fallback ke porsi lazim FOOD_DB) */
  portion_g: loose(z.number().positive().optional()),
  portion_desc: z.string().optional(),   // "1 piring", "setengah mangkuk"
  confidence: loose(z.number().min(0).max(1).optional()),
});

/** Buang entri dish tanpa nama string sebelum validasi (vision kadang kirim item rusak). */
function keepValidDishes(v: unknown): unknown {
  if (v && typeof v === "object" && Array.isArray((v as { dishes?: unknown }).dishes)) {
    const o = v as { dishes: unknown[] };
    return { ...o, dishes: o.dishes.filter((d) => d && typeof d === "object" && typeof (d as { name?: unknown }).name === "string") };
  }
  return v;
}

export const identifiedMealSchema = z.preprocess(
  (v) => keepValidDishes(stripNulls(v)),
  z.object({
    dishes: z.array(dishSchema).default([]),
    meal_type: z.enum(["sarapan", "siang", "malam", "camilan"]).optional(),
    notes: z.string().optional(),
  }),
);

export type IdentifiedMeal = z.infer<typeof identifiedMealSchema>;

export interface ResolvedItem {
  /** nama hasil identifikasi AI (mentah) */
  identifiedName: string;
  food: FoodItem;
  portionG: number;
  /** apakah porsi dari AI atau default porsi lazim FOOD_DB */
  portionSource: "ai" | "default";
}

export interface ResolvedMeal {
  items: ResolvedItem[];
  /** hidangan yang tak ada di FOOD_DB — user pilih manual / abaikan */
  unresolved: string[];
  total: ServingNutrients;
  mealType?: IdentifiedMeal["meal_type"];
}

/**
 * Petakan hidangan teridentifikasi → FOOD_DB + gizi total (deterministik).
 * Hidangan tak dikenal masuk `unresolved`. Porsi: pakai perkiraan AI bila ada,
 * selain itu porsi lazim FOOD_DB.
 */
export function resolveMeal(meal: IdentifiedMeal): ResolvedMeal {
  const items: ResolvedItem[] = [];
  const unresolved: string[] = [];
  for (const d of meal.dishes) {
    const food = findFood(d.name);
    if (!food) { unresolved.push(d.name); continue; }
    const hasAi = typeof d.portion_g === "number" && d.portion_g > 0;
    items.push({
      identifiedName: d.name, food,
      portionG: hasAi ? d.portion_g! : food.typicalPortionG,
      portionSource: hasAi ? "ai" : "default",
    });
  }
  const plate: PlateItem[] = items.map((i) => ({ food: i.food, portionG: i.portionG }));
  return { items, unresolved, total: estimatePlate(plate), mealType: meal.meal_type };
}
