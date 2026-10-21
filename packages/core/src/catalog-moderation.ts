/**
 * Katalog Komunal — moderasi (backlog · KC-2a) — primitif anti-spam DETERMINISTIK untuk pool
 * bersama (addendum-katalog §3): (1) sanity-gate kontribusi (tolak angka garbage sebelum masuk
 * pool), (2) status tepercaya/sembunyi dari jumlah kontribusi + laporan. Konsensus median sendiri
 * ada di `product-catalog.consensusNutrition`. MURNI (tanpa I/O) → teruji. Dipakai server (Edge
 * Function KC-2) sebelum menerima/menampilkan entri; gerbang konten §6 tetap wajib lewat.
 */

import type { NutritionInput, ServingNutrients } from "./nutrition.ts";

/** Batas atas MASUK AKAL per takaran saji — longgar; hanya menjaring garbage/spam, bukan produk nyata. */
export interface ContributionBounds {
  sugarG: number; sodiumMg: number; satFatG: number; totalFatG: number;
  carbG: number; fiberG: number; proteinG: number; energyKcal: number;
  servingSize: number; servingsPerPack: number;
}
export const DEFAULT_CONTRIB_BOUNDS: ContributionBounds = {
  sugarG: 200, sodiumMg: 10000, satFatG: 200, totalFatG: 300, carbG: 400,
  fiberG: 200, proteinG: 200, energyKcal: 2000, servingSize: 5000, servingsPerPack: 500,
};

const SERVING_FIELDS: (keyof ServingNutrients)[] = [
  "sugarG", "sodiumMg", "satFatG", "totalFatG", "carbG", "fiberG", "proteinG", "energyKcal",
];

export interface PlausibilityResult { ok: boolean; reasons: string[] }

/**
 * Sanity-gate kontribusi: tolak nilai non-finite/negatif atau di atas batas masuk akal
 * (per takaran). `ok:false` → JANGAN terima ke pool. Longgar: hanya menjaring garbage/spam.
 */
export function isPlausibleContribution(n: NutritionInput, bounds: ContributionBounds = DEFAULT_CONTRIB_BOUNDS): PlausibilityResult {
  const reasons: string[] = [];
  const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

  const checkMax = (val: number | undefined, field: keyof ServingNutrients, max: number) => {
    if (val === undefined) return;
    if (!num(val) || val < 0) { reasons.push(`${field} tak valid`); return; }
    if (val > max) reasons.push(`${field} di luar batas wajar (>${max})`);
  };
  for (const f of SERVING_FIELDS) checkMax(n.serving?.[f], f, bounds[f as keyof ContributionBounds]);

  if (!num(n.servingSize) || n.servingSize <= 0 || n.servingSize > bounds.servingSize) reasons.push("servingSize tak wajar");
  if (!num(n.servingsPerPack) || n.servingsPerPack <= 0 || n.servingsPerPack > bounds.servingsPerPack) reasons.push("servingsPerPack tak wajar");
  if (n.foodForm !== "solid" && n.foodForm !== "beverage") reasons.push("foodForm tak valid");

  return { ok: reasons.length === 0, reasons };
}

export type CatalogTrust = "unverified" | "trusted";
export interface CatalogEntryStatus {
  trust: CatalogTrust;
  hidden: boolean;      // disembunyikan karena laporan ≥ ambang (moderasi)
  confidence: number;   // 0..1 — kekuatan konsensus (jumlah kontribusi vs ambang tepercaya)
}

export interface CatalogStatusOpts { minTrusted?: number; hideAtFlags?: number }

/**
 * Status entri katalog komunal dari jumlah kontribusi & laporan. Tepercaya bila kontribusi ≥
 * `minTrusted` (default 3); disembunyikan bila laporan ≥ `hideAtFlags` (default 3). Deterministik.
 */
export function catalogEntryStatus(
  input: { contributions: number; flags: number }, opts: CatalogStatusOpts = {},
): CatalogEntryStatus {
  const minTrusted = Math.max(1, Math.round(opts.minTrusted ?? 3));
  const hideAtFlags = Math.max(1, Math.round(opts.hideAtFlags ?? 3));
  const contributions = Math.max(0, Math.round(input.contributions));
  const flags = Math.max(0, Math.round(input.flags));

  const hidden = flags >= hideAtFlags;
  const trust: CatalogTrust = contributions >= minTrusted ? "trusted" : "unverified";
  const confidence = Math.max(0, Math.min(1, contributions / minTrusted));
  return { trust, hidden, confidence };
}
