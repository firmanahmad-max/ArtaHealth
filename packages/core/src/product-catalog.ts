/**
 * Katalog Produk Komunal (backlog · KC-1) — engine DETERMINISTIK: normalisasi identitas produk,
 * konsensus median lintas kontribusi (tahan spam/outlier), rakit katalog, & pencarian. MURNI
 * (tanpa I/O) → teruji; dipakai katalog LOKAL sekarang (KC-1) & komunal termoderasi nanti (KC-2).
 * Fakta gizi produk BUKAN data pribadi; verdict tetap dihitung di perangkat. Lihat docs/addendum-katalog.md.
 */

import type { NutritionInput, ServingNutrients, FoodForm } from "./nutrition.ts";

/** Token ukuran/berat yang tak membedakan identitas produk (dirapikan saat normalisasi). */
const SIZE_TOKEN = /\b\d+([.,]\d+)?\s?(g|gr|gram|kg|ml|l|liter|mg|pcs|pack|sachet|renceng|x\d+)\b/gi;

/**
 * Kunci identitas ternormalisasi dari nama produk: huruf kecil, buang tanda baca, buang token
 * ukuran, rapikan spasi. "Indomie Goreng 85g" & "indomie goreng" → "indomie goreng".
 */
export function normalizeProductKey(name: string): string {
  return (name ?? "")
    .toLowerCase()
    .replace(SIZE_TOKEN, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Satu kontribusi anonim tingkat-produk (tanpa identitas/konsumsi pengguna). */
export interface CatalogContribution {
  displayName: string;
  foodForm: FoodForm;
  nutrition: NutritionInput;
  at: string;                 // ISO — hanya untuk pilih nama tampil terbaru, bukan waktu konsumsi
}

export interface CatalogEntry {
  key: string;
  displayName: string;
  foodForm: FoodForm;
  nutrition: NutritionInput;  // konsensus (median)
  contributions: number;
  updatedAt: string;
}

/** Median deterministik dari daftar angka (sudah difilter finite). Genap → rata-rata dua tengah. */
function median(vals: number[]): number {
  const s = vals.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  return Math.round(m * 100) / 100;
}

const SERVING_KEYS: (keyof ServingNutrients)[] = [
  "energyKcal", "sugarG", "sodiumMg", "satFatG", "transFatG", "totalFatG", "carbG", "fiberG", "proteinG",
];

/**
 * Konsensus median gizi lintas kontribusi (tahan outlier/spam tunggal). Field saji diambil median
 * atas nilai yang ADA saja (hilang di sebagian kontribusi tak dianggap 0). Bentuk = mayoritas.
 */
export function consensusNutrition(inputs: NutritionInput[]): NutritionInput {
  if (inputs.length === 0) throw new Error("consensusNutrition: butuh minimal satu kontribusi");
  const serving: ServingNutrients = {};
  for (const k of SERVING_KEYS) {
    const present = inputs.map((i) => i.serving[k]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (present.length > 0) serving[k] = median(present);
  }
  const beverage = inputs.filter((i) => i.foodForm === "beverage").length;
  const foodForm: FoodForm = beverage * 2 > inputs.length ? "beverage" : "solid";
  return {
    foodForm,
    serving,
    servingSize: median(inputs.map((i) => i.servingSize)),
    servingsPerPack: median(inputs.map((i) => i.servingsPerPack)),
  };
}

/**
 * Rakit katalog dari kontribusi: kelompokkan per kunci ternormalisasi, gizi = konsensus median,
 * nama tampil = kontribusi terbaru, hitung jumlah. Urut kontribusi terbanyak lalu nama.
 */
export function buildCatalog(contributions: CatalogContribution[]): CatalogEntry[] {
  const groups = new Map<string, CatalogContribution[]>();
  for (const c of contributions) {
    const key = normalizeProductKey(c.displayName);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const entries: CatalogEntry[] = [];
  for (const [key, rows] of groups) {
    const latest = rows.slice().sort((a, b) => a.at.localeCompare(b.at))[rows.length - 1]!;
    const nutrition = consensusNutrition(rows.map((r) => r.nutrition));
    entries.push({
      key,
      displayName: latest.displayName.trim(),
      foodForm: nutrition.foodForm,
      nutrition,
      contributions: rows.length,
      updatedAt: latest.at,
    });
  }
  return entries.sort((a, b) => b.contributions - a.contributions || a.displayName.localeCompare(b.displayName));
}

/**
 * Cari entri katalog berdasarkan kueri (ternormalisasi). Peringkat: cocok persis kunci >
 * kunci diawali kueri > mengandung kueri. Kueri kosong → daftar apa adanya (urutan katalog).
 */
export function searchCatalog(entries: CatalogEntry[], query: string, limit = 20): CatalogEntry[] {
  const q = normalizeProductKey(query);
  if (!q) return entries.slice(0, limit);
  const rank = (e: CatalogEntry): number =>
    e.key === q ? 0 : e.key.startsWith(q) ? 1 : e.key.includes(q) ? 2 : 3;
  return entries
    .map((e) => ({ e, r: rank(e) }))
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || b.e.contributions - a.e.contributions || a.e.displayName.localeCompare(b.e.displayName))
    .slice(0, limit)
    .map((x) => x.e);
}
