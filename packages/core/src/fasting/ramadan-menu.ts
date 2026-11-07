/**
 * Perencana Menu Sahur & Berbuka (Fase 9 · manfaat Paket Ramadan #3). Engine MURNI & deterministik:
 * menyusun piring sahur & berbuka HANYA dari FOOD_DB (sudah ditinjau ahli gizi vs TKPI) — tidak
 * ada angka gizi baru. Penilaian = beban GGL per porsi lazim terhadap anggaran harian
 * (`dailyBudget`, sama dgn Sadar Gizi), dengan bobot sesuai kondisi:
 *   - sahur: natrium ×1.5 (makanan asin mempercepat haus saat puasa)
 *   - hipertensi: natrium ×2 · diabetes: gula ×2 · dislipidemia: lemak ×2
 *   - serat sedikit menambah nilai (mengenyangkan lebih lama)
 * Variasi harian: tiap slot memilih bergiliran dari 3 kandidat terbaik menurut `dayIndex`.
 * NON-MEDIS: ide menu umum, bukan diet terapi; tips bersifat umum.
 */

import { FOOD_DB, type FoodItem } from "../food-db.ts";
import { estimatePlate } from "../food-estimate.ts";
import { dailyBudget, type NutritionCondition, type ServingNutrients } from "../nutrition.ts";

export type RamadanMeal = "sahur" | "berbuka";

export interface MenuItem { food: FoodItem; portionG: number; role: string }

export interface MealPlan {
  meal: RamadanMeal;
  items: MenuItem[];
  totals: ServingNutrients;
  tips: string[];
  /** true bila meski sudah ditukar, piring masih melewati jatah per-makan (MEAL_BUDGET_SHARE). */
  overBudget: boolean;
}

/** Jatah tiap makan besar (sahur / berbuka) dari anggaran harian, per sumbu GGL. Sisa 20% untuk takjil/camilan. */
export const MEAL_BUDGET_SHARE = 0.4;

export interface RamadanMenuPlan {
  sahur: MealPlan;
  berbuka: MealPlan;
  /** Gabungan sahur + berbuka dibanding anggaran harian (sisa untuk camilan malam, dst). */
  budget: { sugar: number; sodium: number; fat: number };
  used: { sugar: number; sodium: number; fat: number };
}

export interface RamadanMenuOptions {
  conditions: NutritionCondition[];
  dayIndex: number;              // hari ke-n Ramadan (0-based) → rotasi deterministik
  exclude?: string[];            // id FOOD_DB yang tak diinginkan pengguna
}

const TOP_N = 3;

/** Slot piring: peran + kandidat (filter atas FOOD_DB). */
interface Slot { role: string; pick: (f: FoodItem) => boolean }

// Minuman/takjil manis tinggi gula & gorengan sengaja tak masuk kandidat — sisanya ditentukan skor.
const FRIED_SNACK = new Set(["bakwan", "pisang-goreng", "tahu-isi", "martabak-manis", "donat", "risoles", "keripik"]);
const SUGARY_DRINK = (f: FoodItem) => f.category === "minuman" && (f.per100g.sugarG ?? 0) > 5;
const INSTANT = new Set(["indomie-goreng"]);

const SAHUR_SLOTS: Slot[] = [
  { role: "Karbohidrat", pick: (f) => (f.category === "nasi" || f.category === "roti") && !INSTANT.has(f.id) },
  { role: "Lauk", pick: (f) => f.category === "lauk" },
  { role: "Sayur", pick: (f) => f.category === "sayur" },
  { role: "Buah", pick: (f) => f.category === "buah" },
  { role: "Minuman", pick: (f) => f.category === "minuman" && !SUGARY_DRINK(f) },
];

const BERBUKA_SLOTS: Slot[] = [
  { role: "Pembuka", pick: (f) => f.category === "buah" },
  { role: "Karbohidrat", pick: (f) => (f.category === "nasi" || f.category === "mie") && !INSTANT.has(f.id) },
  { role: "Lauk", pick: (f) => f.category === "lauk" },
  { role: "Sayur / sup", pick: (f) => f.category === "sayur" || f.category === "sup" },
];

export const RAMADAN_MENU_TIPS: Record<RamadanMeal, string[]> = {
  sahur: [
    "Makan sahur mendekati imsak agar tenaga lebih tahan lama.",
    "Batasi makanan asin & bersantan — keduanya mempercepat rasa haus.",
    "Minum air bertahap sejak berbuka hingga sahur, jangan sekaligus.",
  ],
  berbuka: [
    "Awali dengan air putih & kurma/buah secukupnya, lalu jeda sebelum makan besar.",
    "Kurangi takjil gorengan & minuman manis saat berbuka.",
    "Makan perlahan — porsi besar sekaligus mudah membuat begah.",
  ],
};

const CONDITION_TIP: Partial<Record<NutritionCondition, string>> = {
  diabetes: "Bila memakai obat atau insulin penurun gula, ikuti anjuran dokter soal jadwal & dosis selama puasa.",
  hypertension: "Jatah natrium lebih ketat untuk pemantauan tensi — menu dipilih yang rendah garam.",
};

function weights(meal: RamadanMeal, conditions: NutritionCondition[]) {
  const c = new Set(conditions);
  return {
    sugar: c.has("diabetes") ? 2 : 1,
    sodium: (meal === "sahur" ? 1.5 : 1) * (c.has("hypertension") ? 2 : 1),
    fat: c.has("dyslipidemia") ? 2 : 1,
  };
}

/** Skor beban (lebih kecil = lebih baik) satu hidangan pada porsi lazim. */
export function mealScore(food: FoodItem, meal: RamadanMeal, conditions: NutritionCondition[]): number {
  const b = dailyBudget(conditions);
  const w = weights(meal, conditions);
  const k = food.typicalPortionG / 100;
  const p = food.per100g;
  const load =
    w.sugar * ((p.sugarG ?? 0) * k) / b.sugar +
    w.sodium * (p.sodiumMg * k) / b.sodium +
    w.fat * (p.fatG * k) / b.fat;
  const fiberBonus = Math.min(0.05, ((p.fiberG ?? 0) * k) / 100);
  return Math.round((load - fiberBonus) * 10_000) / 10_000;
}

type Ggl = { sugar: number; sodium: number; fat: number };
const AXES = ["sugar", "sodium", "fat"] as const;

const gglOf = (f: FoodItem): Ggl => {
  const k = f.typicalPortionG / 100;
  return { sugar: (f.per100g.sugarG ?? 0) * k, sodium: f.per100g.sodiumMg * k, fat: f.per100g.fatG * k };
};
const sumGgl = (fs: FoodItem[]): Ggl =>
  fs.map(gglOf).reduce((a, g) => ({ sugar: a.sugar + g.sugar, sodium: a.sodium + g.sodium, fat: a.fat + g.fat }), { sugar: 0, sodium: 0, fat: 0 });
/** Kelebihan ternormalisasi di atas jatah (0 = muat di semua sumbu). */
const overflow = (t: Ggl, target: Ggl, budget: Ggl): number =>
  AXES.reduce((s, a) => s + Math.max(0, t[a] - target[a]) / budget[a], 0);

function buildMeal(meal: RamadanMeal, slots: Slot[], opts: RamadanMenuOptions): MealPlan {
  const excluded = new Set(opts.exclude ?? []);
  const budget = dailyBudget(opts.conditions);
  const target: Ggl = { sugar: budget.sugar * MEAL_BUDGET_SHARE, sodium: budget.sodium * MEAL_BUDGET_SHARE, fat: budget.fat * MEAL_BUDGET_SHARE };
  const day = Math.max(0, Math.floor(opts.dayIndex));

  // 1) Tiap slot: urutkan kandidat menurut skor; pilih bergiliran dari TOP_N teratas.
  const pools: { role: string; ranked: FoodItem[] }[] = [];
  const chosen: FoodItem[] = [];
  slots.forEach((slot, i) => {
    const ranked = FOOD_DB
      .filter((f) => slot.pick(f) && !excluded.has(f.id) && !FRIED_SNACK.has(f.id))
      .map((f) => ({ f, s: mealScore(f, meal, opts.conditions) }))
      .sort((a, b) => a.s - b.s || a.f.id.localeCompare(b.f.id))
      .map((x) => x.f);
    if (!ranked.length) return;
    const top = ranked.slice(0, TOP_N);
    pools.push({ role: slot.role, ranked });
    chosen.push(top[(day + i) % top.length]!);
  });

  // 2) Perbaikan anggaran: selama piring melewati jatah, tukar satu item dgn kandidat lain di
  //    slotnya yang paling mengurangi kelebihan. Berhenti bila tak ada tukar yang memperbaiki.
  for (let iter = 0; iter < 12; iter++) {
    const cur = overflow(sumGgl(chosen), target, budget);
    if (cur === 0) break;
    let bestSlot = -1, bestFood: FoodItem | null = null, bestOv = cur;
    for (let si = 0; si < pools.length; si++) {
      for (const cand of pools[si]!.ranked) {
        if (chosen.some((c) => c.id === cand.id)) continue;
        const trial = chosen.map((c, j) => (j === si ? cand : c));
        const ov = overflow(sumGgl(trial), target, budget);
        if (ov < bestOv - 1e-9) { bestSlot = si; bestFood = cand; bestOv = ov; }
      }
    }
    if (!bestFood) break;
    chosen[bestSlot] = bestFood;
  }

  const items: MenuItem[] = chosen.map((f, i) => ({ food: f, portionG: f.typicalPortionG, role: pools[i]!.role }));
  const overBudget = overflow(sumGgl(chosen), target, budget) > 0;
  const tips = [...RAMADAN_MENU_TIPS[meal]];
  if (meal === "sahur") {
    for (const c of opts.conditions) { const t = CONDITION_TIP[c]; if (t) tips.push(t); }
  }
  return { meal, items, totals: estimatePlate(items.map((x) => ({ food: x.food, portionG: x.portionG }))), tips, overBudget };
}

export function ramadanMenuPlan(opts: RamadanMenuOptions): RamadanMenuPlan {
  const sahur = buildMeal("sahur", SAHUR_SLOTS, opts);
  const berbuka = buildMeal("berbuka", BERBUKA_SLOTS, opts);
  const sum = (k: "sugarG" | "sodiumMg" | "totalFatG") => Math.round(((sahur.totals[k] ?? 0) + (berbuka.totals[k] ?? 0)) * 10) / 10;
  return {
    sahur, berbuka,
    budget: dailyBudget(opts.conditions),
    used: { sugar: sum("sugarG"), sodium: Math.round(sum("sodiumMg")), fat: sum("totalFatG") },
  };
}
