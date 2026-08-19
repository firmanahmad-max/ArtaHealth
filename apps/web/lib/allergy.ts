"use client";
import { detectAllergens, ALLERGEN_DEFS, type AllergenMatch, type SelectedAllergen } from "@arta/core";
import { db, type LocalAllergyCard, type AllergenEntry } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";

/**
 * Kartu alergi per-profil (Fase 4 · NG-4) — offline-first, satu baris per profil
 * (kunci profileId, pola fasting_settings). Sumber daftar alergen yang dipantau
 * untuk deteksi pada `ingredients_raw` hasil pindai. App MENANDAI kemungkinan,
 * tidak menjamin "bebas alergen" (bahasa disepakati saat review §11).
 * ⚠️ Di balik flag NEXT_PUBLIC_FEATURE_NUTRITION; daftar sinonim menunggu review.
 */

export { ALLERGEN_DEFS };
export type { AllergenMatch };

/** Kartu alergi profil aktif (undefined bila belum ada). */
export async function getAllergyCard(): Promise<LocalAllergyCard | undefined> {
  const profileId = await getActiveProfileId();
  const card = await db.allergy_cards.get(profileId);
  return card && !card.deletedAt ? card : undefined;
}

/** Daftar alergen yang dipantau (kosong bila belum diatur). */
export async function selectedAllergens(): Promise<AllergenEntry[]> {
  return (await getAllergyCard())?.allergens ?? [];
}

/**
 * Read-modify-write ATOMIK dalam satu transaksi Dexie — mencegah lost update saat
 * beberapa toggle ditekan cepat (baca daftar basi → tulis menimpa). `mutator`
 * menerima kartu saat ini dan mengembalikan daftar alergen (opsional notes) baru.
 */
async function mutateCard(
  mutator: (prev: LocalAllergyCard | undefined) => { allergens?: AllergenEntry[]; notes?: string },
): Promise<void> {
  const profileId = await getActiveProfileId();
  await db.transaction("rw", db.allergy_cards, db.outbox, async () => {
    const prev = await db.allergy_cards.get(profileId);
    const next = mutator(prev);
    await db.allergy_cards.put({
      profileId,
      allergens: next.allergens ?? prev?.allergens ?? [],
      notes: next.notes !== undefined ? next.notes : prev?.notes,
      updatedAt: new Date().toISOString(), deletedAt: null,
    });
    await db.outbox.add({ table: "allergy_cards", clientId: profileId, attempts: 0, queuedAt: new Date().toISOString() });
  });
  void flushOutbox();
}

/** Nyalakan/matikan alergen standar (Big-9) — idempoten. */
export async function toggleAllergen(key: string, on: boolean): Promise<void> {
  await mutateCard((prev) => {
    const list = prev?.allergens ?? [];
    const has = list.some((a) => a.key === key);
    return { allergens: on ? (has ? list : [...list, { key }]) : list.filter((a) => a.key !== key) };
  });
}

/** Tambah alergen kustom (nama bebas + sinonim opsional). */
export async function addCustomAllergen(label: string, terms?: string[]): Promise<void> {
  const name = label.trim();
  if (!name) return;
  const key = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
  const extra = (terms ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  await mutateCard((prev) => {
    const list = prev?.allergens ?? [];
    if (list.some((a) => a.key === key)) return { allergens: list };
    return { allergens: [...list, { key, label: name, terms: extra.length ? extra : undefined, custom: true }] };
  });
}

export async function removeAllergen(key: string): Promise<void> {
  await mutateCard((prev) => ({ allergens: (prev?.allergens ?? []).filter((a) => a.key !== key) }));
}

export async function setAllergyNotes(notes: string): Promise<void> {
  await mutateCard(() => ({ notes }));
}

/** Deteksi alergen yang dipantau pada teks daftar bahan (kosong bila tak ada kartu). */
export async function detectForScan(ingredientsRaw: string): Promise<AllergenMatch[]> {
  const list = await selectedAllergens();
  if (!ingredientsRaw?.trim() || list.length === 0) return [];
  return detectAllergens(ingredientsRaw, list as SelectedAllergen[]);
}
