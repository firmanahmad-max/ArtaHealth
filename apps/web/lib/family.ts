"use client";
import { db, type LocalFamilyMember } from "./db";
import { getActiveProfileId } from "./sync";

/**
 * Family Health / Caregiver (Fase 6 · FM-1) — roster anggota keluarga. Pendekatan
 * ADITIF: kelola anggota di bagian Family terpisah, TANPA switcher profil global
 * (fitur live single-profile tak tersentuh). Anggota = profil nyata; `id` anggota
 * dipakai sebagai profile_id data kesehatannya (FM-2). "Saya" = profil utama.
 * ⚠️ FM-1 lokal (Dexie); sync ke tabel profiles + data kesehatan per-anggota = FM-2.
 */

export type Relation = LocalFamilyMember["relation"];

export const RELATION_LABEL: Record<Relation, string> = {
  self: "Saya", father: "Ayah", mother: "Ibu", child: "Anak", elder: "Orang tua/Lansia", other: "Lainnya",
};

/** Umur (tahun) dari tanggal lahir, atau null. */
export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

/**
 * Pastikan ada entri "Saya" (profil utama) di roster. WRITE — panggil di efek mount,
 * BUKAN di dalam familyMembers() (liveQuery read-only → ReadOnlyError).
 */
export async function ensureSelf(): Promise<void> {
  const existing = await db.family_members.toArray();
  if (existing.some((m) => m.isSelf && !m.deletedAt)) return;
  const profileId = await getActiveProfileId();
  const name = (await db.meta.get("displayName"))?.value || "Saya";
  await db.family_members.put({
    id: profileId, displayName: name, relation: "self", isSelf: true,
    createdAt: new Date().toISOString(), deletedAt: null,
  });
}

/** Roster anggota aktif (READ-ONLY): "Saya" dulu, lalu anggota lain urut nama. */
export async function familyMembers(): Promise<LocalFamilyMember[]> {
  const rows = (await db.family_members.toArray()).filter((m) => !m.deletedAt);
  return rows.sort((a, b) =>
    a.isSelf === b.isSelf ? a.displayName.localeCompare(b.displayName, "id") : a.isSelf ? -1 : 1);
}

export async function addMember(args: {
  displayName: string; relation: Relation; dob?: string | null; sex?: "male" | "female" | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  await db.family_members.put({
    id, displayName: args.displayName.trim(), relation: args.relation,
    dob: args.dob || null, sex: args.sex || null, isSelf: false,
    createdAt: new Date().toISOString(), deletedAt: null,
  });
  return id;
}

export async function updateMember(id: string, patch: Partial<Pick<LocalFamilyMember, "displayName" | "relation" | "dob" | "sex">>): Promise<void> {
  await db.family_members.update(id, patch);
}

/** Hapus anggota (tombstone). "Saya" tak bisa dihapus. */
export async function removeMember(id: string): Promise<void> {
  const m = await db.family_members.get(id);
  if (!m || m.isSelf) return;
  await db.family_members.update(id, { deletedAt: new Date().toISOString() });
}
