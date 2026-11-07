"use client";
import { ramadanMenuPlan, type RamadanMenuPlan, type MealPlan } from "@arta/core";
import { getFastingSettings } from "./fasting";
import { nutritionConditions, logFood } from "./nutrition";
import { todayKey } from "./habits";

/**
 * Perencana Menu Sahur & Berbuka (Fase 9 · manfaat Paket Ramadan #3) — kondisi dipantau
 * (nutritionConditions, sama dgn Sadar Gizi) + hari ke-n Ramadan → engine deterministik
 * @arta/core ramadanMenuPlan. null di luar rentang Ramadan (kartu sembunyi).
 */

const dayDiff = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export interface RamadanMenuContext { plan: RamadanMenuPlan; dayNumber: number; totalDays: number }

/** `shift` = geser rotasi ("Ganti ide") tanpa mengubah hari. */
export async function ramadanMenuToday(shift = 0, today = todayKey()): Promise<RamadanMenuContext | null> {
  const s = await getFastingSettings();
  if (!s.ramadanEnabled || !s.ramadanStart || !s.ramadanEnd) return null;
  if (today < s.ramadanStart || today > s.ramadanEnd) return null;
  const dayIndex = dayDiff(s.ramadanStart, today);
  const conditions = await nutritionConditions();
  return {
    plan: ramadanMenuPlan({ conditions, dayIndex: dayIndex + shift }),
    dayNumber: dayIndex + 1,
    totalDays: dayDiff(s.ramadanStart, s.ramadanEnd) + 1,
  };
}

/** Catat satu piring ke Food Diary (satu baris, total GGL piring). */
export async function logMealPlan(meal: MealPlan): Promise<void> {
  await logFood({
    name: `${meal.meal === "sahur" ? "Sahur" : "Berbuka"}: ${meal.items.map((i) => i.food.name).join(", ")}`,
    mealType: meal.meal === "sahur" ? "sahur" : "iftar",
    sugarG: meal.totals.sugarG ?? 0,
    sodiumMg: meal.totals.sodiumMg ?? 0,
    fatG: meal.totals.totalFatG ?? 0,
    energyKcal: meal.totals.energyKcal ?? 0,
  });
}
