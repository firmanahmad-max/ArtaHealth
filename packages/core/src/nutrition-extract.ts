import { z } from "zod";
import type { NutritionInput, FoodForm } from "./nutrition.ts";

/**
 * Kontrak ekstraksi label gizi (output vision, divalidasi Zod) + VALIDATOR SANITY
 * deterministik (addendum-sadar-gizi §3). Vision hanya membaca label→JSON; lapisan
 * ini menangkap kesalahan OCR klasik SEBELUM verdict dirender — verdict tidak
 * pernah tampil dari data yang diragukan.
 */

const amount = z.number().nonnegative().optional();

export const perServingSchema = z.object({
  energy_kcal: amount,
  fat_g: amount,
  sat_fat_g: amount,
  trans_fat_g: amount,
  protein_g: amount,
  carb_g: amount,
  sugar_g: amount,
  fiber_g: amount,
  sodium_mg: amount,
});

const extractedLabelObject = z.object({
  product_guess: z.string().optional(),
  serving_size: z.object({ value: z.number().positive(), unit: z.enum(["g", "ml"]) }),
  servings_per_pack: z.number().positive(),
  net_content: z.object({ value: z.number().positive(), unit: z.enum(["g", "ml"]) }).optional(),
  per_serving: perServingSchema,
  akg_basis_kcal: z.number().positive().optional(),
  ingredients_raw: z.string().optional(),
  confidence: z.record(z.string(), z.number().min(0).max(1)).optional(),
});

/**
 * Buang key bernilai `null` (jadikan undefined) sebelum validasi. Model vision
 * (mis. GPT-5) kerap mengisi field kosong dengan `null` eksplisit — tanpa ini,
 * `ingredients_raw: null` dll. gagal `.optional()` ("expected string, received null").
 */
function stripNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripNulls);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== null) out[k] = stripNulls(val);
    }
    return out;
  }
  return v;
}

export const extractedLabelSchema = z.preprocess(stripNulls, extractedLabelObject);

export type ExtractedLabel = z.infer<typeof extractedLabelSchema>;

export interface SanityResult {
  /** masalah konsistensi/satuan yang perlu ditinjau user */
  issues: { field: string; message: string }[];
  /** field yang perlu dikonfirmasi (masalah sanity atau confidence rendah) */
  recheck: string[];
  needsConfirmation: boolean;
}

const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Aturan sanity §3 — menandai (bukan menolak) agar user mengonfirmasi:
 *  · satuan natrium (mg vs g — "2 g" = 2000 mg)
 *  · energi ≈ 4×(karbo+protein) + 9×lemak, toleransi ±25%
 *  · gula ≤ karbohidrat total; lemak jenuh ≤ lemak total
 *  · takaran saji × jumlah sajian ≈ isi bersih kemasan
 *  · confidence < 0.7 pada field kunci
 */
export function sanityCheck(label: ExtractedLabel): SanityResult {
  const issues: { field: string; message: string }[] = [];
  const recheck = new Set<string>();
  const p = label.per_serving;

  // 1) satuan natrium — nilai kecil menandai kemungkinan g terbaca sebagai mg
  if (p.sodium_mg !== undefined && p.sodium_mg > 0 && p.sodium_mg <= 20) {
    issues.push({ field: "sodium_mg", message: "Pastikan satuan natrium dalam mg (bukan g)." });
    recheck.add("sodium_mg");
  }

  // 2) keseimbangan energi vs makronutrien (±25%)
  if (p.energy_kcal !== undefined && p.energy_kcal > 0 &&
      (p.carb_g !== undefined || p.protein_g !== undefined || p.fat_g !== undefined)) {
    const est = 4 * ((p.carb_g ?? 0) + (p.protein_g ?? 0)) + 9 * (p.fat_g ?? 0);
    const denom = Math.max(p.energy_kcal, est, 1);
    if (Math.abs(p.energy_kcal - est) / denom > 0.25) {
      issues.push({ field: "energy_kcal", message: "Energi tidak konsisten dengan karbo/protein/lemak — cek angkanya." });
      recheck.add("energy_kcal");
    }
  }

  // 3) gula ≤ karbohidrat total
  if (p.sugar_g !== undefined && p.carb_g !== undefined && p.sugar_g > p.carb_g) {
    issues.push({ field: "sugar_g", message: "Gula melebihi karbohidrat total — kemungkinan salah baca." });
    recheck.add("sugar_g");
  }

  // 4) lemak jenuh ≤ lemak total
  if (p.sat_fat_g !== undefined && p.fat_g !== undefined && p.sat_fat_g > p.fat_g) {
    issues.push({ field: "sat_fat_g", message: "Lemak jenuh melebihi lemak total — kemungkinan salah baca." });
    recheck.add("sat_fat_g");
  }

  // 5) takaran saji × jumlah sajian ≈ isi bersih (satuan sama, ±10%)
  if (label.net_content && label.net_content.unit === label.serving_size.unit) {
    const impliedTotal = label.serving_size.value * label.servings_per_pack;
    if (Math.abs(impliedTotal - label.net_content.value) / label.net_content.value > 0.1) {
      issues.push({ field: "servings_per_pack", message: "Takaran saji × jumlah sajian tidak cocok dengan isi bersih." });
      recheck.add("servings_per_pack");
    }
  }

  // 6) confidence rendah pada field kunci
  for (const [field, c] of Object.entries(label.confidence ?? {})) {
    if (c < CONFIDENCE_THRESHOLD) recheck.add(field);
  }

  return { issues, recheck: [...recheck], needsConfirmation: issues.length > 0 || recheck.size > 0 };
}

/** Peta hasil ekstraksi → input rule engine verdict (satuan sudah per takaran saji). */
export function toNutritionInput(label: ExtractedLabel, foodForm: FoodForm): NutritionInput {
  const p = label.per_serving;
  return {
    foodForm,
    serving: {
      energyKcal: p.energy_kcal, sugarG: p.sugar_g, sodiumMg: p.sodium_mg,
      satFatG: p.sat_fat_g, transFatG: p.trans_fat_g, totalFatG: p.fat_g,
      carbG: p.carb_g, fiberG: p.fiber_g, proteinG: p.protein_g,
    },
    servingSize: label.serving_size.value,
    servingsPerPack: label.servings_per_pack,
  };
}
