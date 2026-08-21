"use client";
import {
  classifyBiomarker, DEFAULT_BIOMARKER_BANDS,
  type BiomarkerInput, type BiomarkerClassification, type Biomarker,
} from "@arta/core";
import { db, type LocalBiomarkerReading } from "./db";

/**
 * Family Health — pantau biomarker anggota (Fase 6 · FM-2). Catat & lihat pembacaan
 * biomarker milik anggota keluarga (profileId = id anggota). Klasifikasi deterministik
 * (engine Fase 2), sama seperti pencatatan diri.
 *
 * ⚠️ LOKAL-FIRST: reading anggota TIDAK di-enqueue outbox (profil anggota belum ada di
 *    tabel profiles server → push akan gagal FK & memblok sync). Sync anggota = FM-3.
 */

function shape(input: BiomarkerInput): { context: string | null; values: Record<string, number> } {
  switch (input.biomarker) {
    case "bp": return { context: null, values: { systolic: input.systolic, diastolic: input.diastolic } };
    case "glucose": return { context: input.context, values: { value: input.value } };
    case "lipid": {
      const v: Record<string, number> = {};
      for (const k of ["totalChol", "ldl", "hdl", "tg"] as const) if (typeof input[k] === "number") v[k] = input[k]!;
      return { context: null, values: v };
    }
    case "uric_acid": return { context: input.sex, values: { value: input.value } };
  }
}

/** Catat satu pembacaan biomarker untuk anggota (lokal). Kembalikan klasifikasi. */
export async function logMemberBiomarker(memberId: string, input: BiomarkerInput): Promise<BiomarkerClassification> {
  const classification = classifyBiomarker(input, DEFAULT_BIOMARKER_BANDS);
  const { context, values } = shape(input);
  const row: LocalBiomarkerReading = {
    clientId: crypto.randomUUID(), profileId: memberId, biomarker: input.biomarker, context,
    values, classification, measuredAt: new Date().toISOString(),
    source: "family", vaultDocId: null, deletedAt: null,
  };
  await db.biomarker_readings.put(row);   // sengaja TANPA enqueue (lihat catatan di atas)
  return classification;
}

/** Semua pembacaan anggota (terbaru dulu). profileId tak ter-index → filter di JS. */
export async function memberReadings(memberId: string): Promise<LocalBiomarkerReading[]> {
  const rows = await db.biomarker_readings.toArray();
  return rows.filter((r) => r.profileId === memberId && !r.deletedAt)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
}

/** Pembacaan terbaru per jenis biomarker (untuk ringkasan). */
export async function memberLatest(memberId: string): Promise<Partial<Record<Biomarker, LocalBiomarkerReading>>> {
  const rows = await memberReadings(memberId); // sudah terurut terbaru dulu
  const out: Partial<Record<Biomarker, LocalBiomarkerReading>> = {};
  for (const r of rows) if (!out[r.biomarker]) out[r.biomarker] = r;
  return out;
}

/** Hapus pembacaan anggota (tombstone, lokal). */
export async function removeMemberReading(clientId: string): Promise<void> {
  await db.biomarker_readings.update(clientId, { deletedAt: new Date().toISOString() });
}
