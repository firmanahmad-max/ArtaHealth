"use client";
import type { NutritionCondition } from "@arta/core";
import { db, type LocalNutritionEater, type AllergenEntry } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";
import { nutritionConditions } from "./nutrition";
import { selectedAllergens } from "./allergy";

/**
 * "Pindai untuk siapa" (Fase 4 · NG-4b). Anggota rumah = persona gizi ringan
 * (nama + relasi + kondisi + alergen) milik profil pemilik. Verdict & deteksi
 * alergen dihitung ulang untuk orang yang dipilih. "Saya" (self) tetap memakai
 * monitored_conditions + allergy_card akun. Sinkron idempoten via PK id.
 * ⚠️ Di balik flag NEXT_PUBLIC_FEATURE_NUTRITION.
 */

/** Konteks personalisasi efektif untuk satu "pemakan". */
export interface EaterContext {
  id: string;                 // "self" atau id eater
  name: string;
  conditions: NutritionCondition[];
  allergens: AllergenEntry[];
  isSelf: boolean;
}

function enqueue(id: string): Promise<unknown> {
  return db.outbox.add({ table: "nutrition_eaters", clientId: id, attempts: 0, queuedAt: new Date().toISOString() });
}

/** Daftar anggota (selain "Saya"), terbaru dulu. */
export async function eaters(): Promise<LocalNutritionEater[]> {
  const rows = await db.nutrition_eaters.toArray();
  return rows.filter((e) => !e.deletedAt).sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function addEater(args: {
  name: string; relation?: string; conditions?: string[]; allergens?: AllergenEntry[];
}): Promise<string> {
  const id = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const row: LocalNutritionEater = {
    id, profileId, name: args.name.trim(), relation: args.relation,
    conditions: args.conditions ?? [], allergens: args.allergens ?? [],
    updatedAt: new Date().toISOString(), deletedAt: null,
  };
  await db.transaction("rw", db.nutrition_eaters, db.outbox, async () => {
    await db.nutrition_eaters.put(row);
    await enqueue(id);
  });
  void flushOutbox();
  return id;
}

export async function updateEater(id: string, patch: Partial<Pick<LocalNutritionEater, "name" | "relation" | "conditions" | "allergens">>): Promise<void> {
  await db.transaction("rw", db.nutrition_eaters, db.outbox, async () => {
    const cur = await db.nutrition_eaters.get(id);
    if (!cur) return;
    await db.nutrition_eaters.put({ ...cur, ...patch, updatedAt: new Date().toISOString() });
    await enqueue(id);
  });
  void flushOutbox();
}

export async function removeEater(id: string): Promise<void> {
  await db.transaction("rw", db.nutrition_eaters, db.outbox, async () => {
    await db.nutrition_eaters.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await enqueue(id);
  });
  void flushOutbox();
}

/**
 * Konteks efektif untuk `eaterId` (null / "self" → kondisi & alergen akun sendiri).
 * Dipakai kartu pindai untuk menghitung verdict & alert alergen per orang.
 */
export async function eaterContext(eaterId: string | null): Promise<EaterContext> {
  if (!eaterId || eaterId === "self") {
    const [conditions, allergens] = await Promise.all([nutritionConditions(), selectedAllergens()]);
    return { id: "self", name: "Saya", conditions, allergens, isSelf: true };
  }
  const e = await db.nutrition_eaters.get(eaterId);
  if (!e || e.deletedAt) {
    const [conditions, allergens] = await Promise.all([nutritionConditions(), selectedAllergens()]);
    return { id: "self", name: "Saya", conditions, allergens, isSelf: true };
  }
  return {
    id: e.id, name: e.name,
    conditions: e.conditions as NutritionCondition[],
    allergens: e.allergens, isSelf: false,
  };
}
