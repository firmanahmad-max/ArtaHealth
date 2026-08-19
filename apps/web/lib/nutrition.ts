"use client";
import {
  nutritionVerdict, DEFAULT_NUTRITION_BANDS,
  type NutritionInput, type NutritionVerdict, type NutritionCondition,
} from "@arta/core";
import { db, type LocalFoodLog, type LocalProductScan } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";
import { monitoredSet, type MonitoredCondition } from "./conditions";

/**
 * Sadar Gizi offline-first (Fase 4 · NG-3). Menghitung verdict DI KLIENT dari
 * `nutritionVerdict` (pola biomarker: engine deterministik, bukan AI) memakai
 * DEFAULT_NUTRITION_BANDS + kondisi terpantau. Menyimpan riwayat scan + food_logs
 * (basis akumulasi GGL Budget harian). Sinkron idempoten via PK id.
 *
 * ⚠️ Verdict tetap DI BALIK flag `NEXT_PUBLIC_FEATURE_NUTRITION` sampai ambang gizi
 *    diverifikasi ahli gizi/BPOM (checklist §11).
 */

/** monitored_conditions (Fase 2) → kondisi gizi engine. hiperurisemia→gout. */
const CONDITION_MAP: Partial<Record<MonitoredCondition, NutritionCondition>> = {
  hypertension: "hypertension",
  diabetes: "diabetes",
  dyslipidemia: "dyslipidemia",
  hyperuricemia: "gout",
};

/** Kondisi gizi aktif untuk personalisasi verdict (anggaran & nutrien utama). */
export async function nutritionConditions(): Promise<NutritionCondition[]> {
  const set = await monitoredSet();
  const out: NutritionCondition[] = [];
  for (const c of set) {
    const mapped = CONDITION_MAP[c];
    if (mapped) out.push(mapped);
  }
  return out;
}

/** Verdict deterministik personalisasi (dipakai kartu hasil). */
export function computeVerdict(input: NutritionInput, conditions: NutritionCondition[]): NutritionVerdict {
  return nutritionVerdict(input, DEFAULT_NUTRITION_BANDS, { conditions });
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function enqueue(table: "product_scans" | "food_logs", id: string): Promise<unknown> {
  return db.outbox.add({ table, clientId: id, attempts: 0, queuedAt: new Date().toISOString() });
}

/** GGL yang sudah terpakai hari ini dari food_logs (gram gula, mg natrium, gram lemak). */
export async function todayGGLUsage(): Promise<{ sugar: number; sodium: number; fat: number }> {
  const rows = await db.food_logs.where("loggedAt").aboveOrEqual(startOfTodayIso()).toArray();
  const acc = { sugar: 0, sodium: 0, fat: 0 };
  for (const r of rows) {
    if (r.deletedAt) continue;
    acc.sugar += r.sugarG ?? 0;
    acc.sodium += r.sodiumMg ?? 0;
    acc.fat += r.fatG ?? 0;
  }
  return acc;
}

/** Catatan makan hari ini (terbaru dulu). */
export async function todayFoodLogs(): Promise<LocalFoodLog[]> {
  const rows = await db.food_logs.where("loggedAt").aboveOrEqual(startOfTodayIso()).toArray();
  return rows.filter((r) => !r.deletedAt).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

/** Simpan riwayat pemindaian/entri (extracted + verdict). Kembalikan id. */
export async function saveScan(args: {
  productName?: string;
  foodForm: "solid" | "beverage";
  extracted: unknown;
  verdict: NutritionVerdict;
  userCorrected?: boolean;
  photoPath?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const row: LocalProductScan = {
    id, profileId, scannedBy: profileId,
    productName: args.productName?.trim() || undefined,
    foodForm: args.foodForm, photoPath: args.photoPath,
    extracted: args.extracted, userCorrected: !!args.userCorrected,
    verdict: args.verdict, scannedAt: new Date().toISOString(), deletedAt: null,
  };
  await db.transaction("rw", db.product_scans, db.outbox, async () => {
    await db.product_scans.put(row);
    await enqueue("product_scans", id);
  });
  void flushOutbox();
  return id;
}

/**
 * Catat konsumsi ke Food Diary → menambah anggaran GGL hari ini.
 * `impact` = GGL yang benar-benar dikonsumsi (per kemasan atau per takaran, sesuai pilihan user).
 */
export async function logFood(args: {
  name?: string;
  mealType?: LocalFoodLog["mealType"];
  sugarG: number;
  sodiumMg: number;
  fatG: number;
  energyKcal?: number;
  sourceScanId?: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const row: LocalFoodLog = {
    id, profileId, name: args.name?.trim() || undefined,
    mealType: args.mealType ?? "camilan",
    sugarG: args.sugarG, sodiumMg: args.sodiumMg, fatG: args.fatG,
    energyKcal: args.energyKcal ?? null, sourceScanId: args.sourceScanId ?? null,
    loggedAt: new Date().toISOString(), deletedAt: null,
  };
  await db.transaction("rw", db.food_logs, db.outbox, async () => {
    await db.food_logs.put(row);
    await enqueue("food_logs", id);
  });
  void flushOutbox();
  return id;
}

/** Batalkan catatan makan (tombstone). */
export async function removeFoodLog(id: string): Promise<void> {
  await db.transaction("rw", db.food_logs, db.outbox, async () => {
    await db.food_logs.update(id, { deletedAt: new Date().toISOString() });
    await enqueue("food_logs", id);
  });
  void flushOutbox();
}
