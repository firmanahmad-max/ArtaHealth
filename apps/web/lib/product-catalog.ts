"use client";
import {
  buildCatalog, searchCatalog, type CatalogContribution, type CatalogEntry,
  type NutritionInput, type NutritionVerdict, type NutritionCondition,
} from "@arta/core";
import { savedProducts, computeVerdict, nutritionConditions } from "./nutrition";

/**
 * Katalog Produk Komunal (backlog · KC-1) — katalog LOKAL dari produk yang pengguna simpan
 * (`saved_products`), via engine deterministik @arta/core. Cari produk & pakai ulang gizinya
 * tanpa scan ulang; verdict tetap dihitung DI PERANGKAT sesuai kondisi pengguna. Berbagi komunal
 * (baca/tulis termoderasi) = KC-2 (tunggu gerbang moderasi) → inert di sini. Lihat docs/addendum-katalog.md.
 */

export interface CatalogHit {
  entry: CatalogEntry;
  verdict: NutritionVerdict;   // dihitung ulang untuk kondisi pengguna (personal)
}

/** Bangun katalog lokal dari lemari produk pengguna (kontribusi tingkat-produk). */
export async function buildLocalCatalog(): Promise<CatalogEntry[]> {
  const rows = await savedProducts();
  const contributions: CatalogContribution[] = rows.map((r) => ({
    displayName: r.productName,
    foodForm: r.foodForm,
    nutrition: r.extracted as NutritionInput,
    at: r.updatedAt,
  }));
  return buildCatalog(contributions);
}

/**
 * Cari di katalog lokal + hitung verdict personal per hasil (kondisi pengguna). Kueri kosong →
 * seluruh katalog (dibatasi limit di engine).
 */
export async function searchLocalCatalog(query: string): Promise<CatalogHit[]> {
  const [entries, conditions] = await Promise.all([buildLocalCatalog(), nutritionConditions()]);
  return searchCatalog(entries, query).map((entry) => ({
    entry,
    verdict: computeVerdict(entry.nutrition, conditions as NutritionCondition[]),
  }));
}
