/**
 * Sadar Gizi — Rule Engine verdict (addendum-sadar-gizi.md §4). DETERMINISTIK.
 * Vision model hanya mengekstrak label → JSON; PENILAIAN dihitung di sini dari
 * tabel ambang ber-versi (nutrition_bands) + anggaran GGL Kemenkes. Bisa
 * dijelaskan & diaudit — tidak berhalusinasi.
 *
 * Prinsip yang ditegakkan:
 *  · Per KEMASAN (bukan per takaran saji) untuk dampak anggaran — bongkar jebakan label.
 *  · Traffic-light per 100 g/ml (mutu bawaan produk) dari bands.
 *  · Anggaran, bukan larangan. Personalisasi ke monitored_conditions.
 *  · Bukan resep medis: anjuran maksimum "batasi / cari alternatif / diskusikan dokter".
 *
 * Ambang di DEFAULT_NUTRITION_BANDS = cermin seed migration 0016. DITINJAU &
 * disetujui ahli gizi (gerbang §10-§11 lulus, Agu 2026) — lihat docs/gate-nutrition-launch.md.
 */

export type Nutrient = "sugar" | "sodium" | "sat_fat" | "total_fat" | "fiber" | "protein";
export type FoodForm = "solid" | "beverage";
export type NutritionZone = "green" | "yellow" | "red";
export type NutritionCondition = "hypertension" | "diabetes" | "dyslipidemia" | "gout";

export interface NutritionBand {
  nutrient: Nutrient;
  foodForm: FoodForm;
  bandKey: "low" | "medium" | "high";
  zone: NutritionZone;
  per100Min: number | null;
  per100Max: number | null;
  conditionTag?: NutritionCondition | null;
  guidelineRef: string;
}

/** Anggaran GGL harian Kemenkes (G4G1L5): gula 50 g · natrium 2000 mg · lemak 67 g. */
export const GGL_BUDGET = { sugar: 50, sodium: 2000, fat: 67 } as const;
/** Basis %AKG label Indonesia (BPOM), bukan 2000 kkal label luar. */
export const AKG_BASIS_KCAL = 2150;

/** Nilai gizi per takaran saji (dari label, hasil ekstraksi tervalidasi). */
export interface ServingNutrients {
  energyKcal?: number;
  sugarG?: number;
  sodiumMg?: number;
  satFatG?: number;
  transFatG?: number;
  totalFatG?: number;
  carbG?: number;
  fiberG?: number;
  proteinG?: number;
}

export interface NutritionInput {
  foodForm: FoodForm;
  serving: ServingNutrients;
  /** ukuran satu takaran saji (g atau ml) */
  servingSize: number;
  /** jumlah takaran saji per kemasan */
  servingsPerPack: number;
}

export interface NutrientVerdict {
  nutrient: Nutrient;
  per100: number;
  perPackage: number;
  zone: NutritionZone;
}

export interface NutritionVerdict {
  overall: NutritionZone;
  headline: string;
  reason: string;
  suggestion: string;
  perNutrient: NutrientVerdict[];
  /** % anggaran harian yang dipakai SATU KEMASAN (personalisasi kondisi) */
  budgetImpact: { sugar: number; sodium: number; fat: number };
  primaryNutrient: Nutrient | null;
  flags: string[];
}

const ZONE_RANK: Record<NutritionZone, number> = { green: 0, yellow: 1, red: 2 };
const NEGATIVE: Nutrient[] = ["sugar", "sodium", "sat_fat"];
const NUTRIENT_LABEL: Record<Nutrient, string> = {
  sugar: "Gula", sodium: "Natrium", sat_fat: "Lemak jenuh",
  total_fat: "Lemak total", fiber: "Serat", protein: "Protein",
};
const HEADLINE: Record<NutritionZone, string> = {
  green: "Pilihan baik", yellow: "Boleh, secukupnya", red: "Sebaiknya batasi",
};

const servingValue = (s: ServingNutrients, n: Nutrient): number => {
  switch (n) {
    case "sugar": return s.sugarG ?? 0;
    case "sodium": return s.sodiumMg ?? 0;
    case "sat_fat": return s.satFatG ?? 0;
    case "total_fat": return s.totalFatG ?? 0;
    case "fiber": return s.fiberG ?? 0;
    case "protein": return s.proteinG ?? 0;
  }
};

/** Klasifikasi traffic-light satu nutrien pada nilai per 100 g/ml. */
export function classifyNutrient(
  nutrient: Nutrient, per100: number, foodForm: FoodForm, bands: NutritionBand[],
  condition?: NutritionCondition,
): NutritionBand | null {
  const pool = bands.filter((b) => b.nutrient === nutrient && b.foodForm === foodForm);
  // ambang spesifik-kondisi menang bila ada; selain itu ambang umum (conditionTag null)
  const scoped = condition ? pool.filter((b) => b.conditionTag === condition) : [];
  const candidates = scoped.length > 0 ? scoped : pool.filter((b) => b.conditionTag == null);
  for (const b of candidates) {
    const okLow = b.per100Min == null || per100 >= b.per100Min;
    const okHigh = b.per100Max == null || per100 < b.per100Max;
    if (okLow && okHigh) return b;
  }
  return null;
}

/** Anggaran harian ter-personalisasi (mis. hipertensi natrium lebih ketat). */
export function dailyBudget(conditions: NutritionCondition[]): { sugar: number; sodium: number; fat: number } {
  const set = new Set(conditions);
  return {
    sugar: GGL_BUDGET.sugar,
    // 1500 mg utk pemantauan tensi — ditinjau & disetujui (gerbang §4.2 lulus)
    sodium: set.has("hypertension") ? 1500 : GGL_BUDGET.sodium,
    fat: GGL_BUDGET.fat,
  };
}

/** Nutrien utama yang disorot untuk kondisi terpantau. */
export function primaryNutrientFor(conditions: NutritionCondition[]): Nutrient | null {
  const set = new Set(conditions);
  if (set.has("hypertension")) return "sodium";
  if (set.has("diabetes")) return "sugar";
  if (set.has("dyslipidemia")) return "sat_fat";
  return null;
}

/**
 * Verdict lengkap: traffic-light per nutrien (per 100), dampak anggaran per KEMASAN,
 * dan verdict keseluruhan 3-tingkat. Tanpa skor angka makanan (kebijakan wellbeing).
 */
export function nutritionVerdict(
  input: NutritionInput, bands: NutritionBand[], opts?: { conditions?: NutritionCondition[] },
): NutritionVerdict {
  const conditions = opts?.conditions ?? [];
  const { foodForm, serving, servingSize, servingsPerPack } = input;
  const to100 = servingSize > 0 ? 100 / servingSize : 0;
  const primary = primaryNutrientFor(conditions);
  const condTag = primary === "sodium" ? "hypertension"
    : primary === "sugar" ? "diabetes" : primary === "sat_fat" ? "dyslipidemia" : undefined;

  const perNutrient: NutrientVerdict[] = [];
  for (const n of NEGATIVE) {
    const perServ = servingValue(serving, n);
    const per100 = perServ * to100;
    const band = classifyNutrient(n, per100, foodForm, bands, n === primary ? condTag : undefined);
    perNutrient.push({ nutrient: n, per100, perPackage: perServ * servingsPerPack, zone: band?.zone ?? "green" });
  }

  const flags: string[] = [];
  // lemak trans: hindari sepenuhnya (WHO) — sedikit pun → merah
  const transPack = (serving.transFatG ?? 0) * servingsPerPack;
  if (transPack > 0) flags.push("Mengandung lemak trans — sebaiknya dihindari");
  // penanda positif
  const fiberPer100 = (serving.fiberG ?? 0) * to100;
  const proteinPer100 = (serving.proteinG ?? 0) * to100;
  if (fiberPer100 >= 6) flags.push("Tinggi serat — nilai plus 👍");
  if (proteinPer100 >= 10) flags.push("Sumber protein baik 👍");

  // verdict keseluruhan = zona terburuk nutrien negatif (+ paksa merah bila ada lemak trans)
  let worst: NutritionZone = "green";
  for (const p of perNutrient) if (ZONE_RANK[p.zone] > ZONE_RANK[worst]) worst = p.zone;
  if (transPack > 0) worst = "red";

  const budget = dailyBudget(conditions);
  const sugarPack = (serving.sugarG ?? 0) * servingsPerPack;
  const sodiumPack = (serving.sodiumMg ?? 0) * servingsPerPack;
  const fatPack = (serving.totalFatG ?? 0) * servingsPerPack;
  const pct = (v: number, b: number) => (b > 0 ? Math.round((v / b) * 100) : 0);
  const budgetImpact = { sugar: pct(sugarPack, budget.sugar), sodium: pct(sodiumPack, budget.sodium), fat: pct(fatPack, budget.fat) };

  // driver alasan: nutrien terburuk (utamakan nutrien utama kondisi bila sama buruk)
  const worstNutrients = perNutrient.filter((p) => p.zone === worst && worst !== "green");
  const driver = worstNutrients.find((p) => p.nutrient === primary) ?? worstNutrients[0];
  const driverPct = driver
    ? (driver.nutrient === "sugar" ? budgetImpact.sugar : driver.nutrient === "sodium" ? budgetImpact.sodium : budgetImpact.fat)
    : 0;

  let reason: string;
  let suggestion: string;
  if (worst === "green") {
    reason = `Kandungan gula, natrium, dan lemak jenuh tergolong rendah${sugarPack > 0 ? ` (gula ${budgetImpact.sugar}% jatah harian)` : ""}.`;
    suggestion = "Aman dinikmati sesuai kebutuhan.";
  } else {
    const label = driver ? NUTRIENT_LABEL[driver.nutrient] : "Nutrisi";
    const tighter = driver?.nutrient === "sodium" && conditions.includes("hypertension")
      ? " (batas lebih ketat karena pemantauan tensi)" : "";
    reason = `${label} satu kemasan ≈ ${driverPct}% anggaran harian Anda${tighter}.`;
    suggestion = worst === "red"
      ? `Pertimbangkan alternatif lebih rendah ${label.toLowerCase()}, atau konsumsi dalam porsi kecil.`
      : "Boleh sesekali — imbangi sisa hari dengan pilihan lebih ringan.";
  }

  return {
    overall: worst, headline: HEADLINE[worst], reason, suggestion,
    perNutrient, budgetImpact, primaryNutrient: primary, flags,
  };
}

/** Cermin seed migration 0016 (v1). Untuk bootstrap offline & unit test. */
export const DEFAULT_NUTRITION_BANDS: NutritionBand[] = [
  band("sugar", "beverage", "low", "green", null, 2.5),
  band("sugar", "beverage", "medium", "yellow", 2.5, 7.5),
  band("sugar", "beverage", "high", "red", 7.5, null),
  band("sugar", "solid", "low", "green", null, 5.0),
  band("sugar", "solid", "medium", "yellow", 5.0, 22.5),
  band("sugar", "solid", "high", "red", 22.5, null),
  band("sodium", "solid", "low", "green", null, 120),
  band("sodium", "solid", "medium", "yellow", 120, 600),
  band("sodium", "solid", "high", "red", 600, null),
  band("sodium", "beverage", "low", "green", null, 120),
  band("sodium", "beverage", "medium", "yellow", 120, 600),
  band("sodium", "beverage", "high", "red", 600, null),
  band("sat_fat", "solid", "low", "green", null, 1.5),
  band("sat_fat", "solid", "medium", "yellow", 1.5, 5.0),
  band("sat_fat", "solid", "high", "red", 5.0, null),
  band("sat_fat", "beverage", "low", "green", null, 1.5),
  band("sat_fat", "beverage", "medium", "yellow", 1.5, 5.0),
  band("sat_fat", "beverage", "high", "red", 5.0, null),
];

function band(
  nutrient: Nutrient, foodForm: FoodForm, bandKey: "low" | "medium" | "high",
  zone: NutritionZone, per100Min: number | null, per100Max: number | null,
): NutritionBand {
  return { nutrient, foodForm, bandKey, zone, per100Min, per100Max, conditionTag: null, guidelineRef: "BPOM Nutri-Level (ditinjau ahli gizi)" };
}
