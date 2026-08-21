"use client";
import {
  classifyBiomarker, DEFAULT_BIOMARKER_BANDS,
  biomarkerReadingSchema,
  type BiomarkerClassification, type GlucoseContext, type Sex,
} from "@arta/core";
import { db, type LocalBiomarkerReading } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";

/**
 * Pencatatan biomarker offline-first (pola quicklog.ts): tulis IndexedDB dulu,
 * klasifikasi DETERMINISTIK di client (engine @arta/core + DEFAULT bands) agar
 * hasil & red-flag tampil instan bahkan offline, antre outbox, flush di background.
 *
 * Bands produksi kelak dimuat dari tabel biomarker_bands; sampai itu pakai default
 * yang mencerminkan seed migration 0010 (menunggu verifikasi dokter).
 */

async function enqueue(clientId: string): Promise<void> {
  await db.outbox.add({ table: "biomarker_readings", clientId, attempts: 0, queuedAt: new Date().toISOString() });
}

export interface BiomarkerLogResult { clientId: string; classification: BiomarkerClassification }

/** Simpan tekanan darah (mmHg). Mengembalikan klasifikasi utk umpan-balik langsung. */
export async function logBloodPressure(
  systolic: number, diastolic: number, note?: string,
): Promise<BiomarkerLogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const measuredAt = new Date();
  // validasi rentang fisiologis (buang input mustahil sebelum klasifikasi)
  biomarkerReadingSchema.parse({ profileId, clientId, measuredAt, biomarker: "bp", systolic, diastolic, note });

  const classification = classifyBiomarker({ biomarker: "bp", systolic, diastolic }, DEFAULT_BIOMARKER_BANDS);
  const row: LocalBiomarkerReading = {
    clientId, profileId, biomarker: "bp", context: null,
    values: { systolic, diastolic }, classification,
    measuredAt: measuredAt.toISOString(), note, deletedAt: null,
  };
  await db.transaction("rw", db.biomarker_readings, db.outbox, async () => {
    await db.biomarker_readings.put(row);
    await enqueue(clientId);
  });
  void flushOutbox();
  return { clientId, classification };
}

/** Simpan gula darah. context menentukan ambang (gdp/gds/pp2/hba1c). */
export async function logGlucose(
  context: GlucoseContext, value: number, note?: string,
): Promise<BiomarkerLogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const measuredAt = new Date();
  biomarkerReadingSchema.parse({ profileId, clientId, measuredAt, biomarker: "glucose", context, value, note });

  const classification = classifyBiomarker({ biomarker: "glucose", context, value }, DEFAULT_BIOMARKER_BANDS);
  const row: LocalBiomarkerReading = {
    clientId, profileId, biomarker: "glucose", context,
    values: { value }, classification,
    measuredAt: measuredAt.toISOString(), note, deletedAt: null,
  };
  await db.transaction("rw", db.biomarker_readings, db.outbox, async () => {
    await db.biomarker_readings.put(row);
    await enqueue(clientId);
  });
  void flushOutbox();
  return { clientId, classification };
}

/** Simpan panel lipid (mg/dL). Minimal satu nilai; klasifikasi = kategori terburuk. */
export async function logLipid(
  vals: { totalChol?: number; ldl?: number; hdl?: number; tg?: number }, note?: string,
): Promise<BiomarkerLogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const measuredAt = new Date();
  biomarkerReadingSchema.parse({ profileId, clientId, measuredAt, biomarker: "lipid", ...vals, note });

  const classification = classifyBiomarker({ biomarker: "lipid", ...vals }, DEFAULT_BIOMARKER_BANDS);
  const values: Record<string, number> = {};
  for (const [k, v] of Object.entries(vals)) if (typeof v === "number") values[k] = v;
  const row: LocalBiomarkerReading = {
    clientId, profileId, biomarker: "lipid", context: null,
    values, classification, measuredAt: measuredAt.toISOString(), note, deletedAt: null,
  };
  await db.transaction("rw", db.biomarker_readings, db.outbox, async () => {
    await db.biomarker_readings.put(row);
    await enqueue(clientId);
  });
  void flushOutbox();
  return { clientId, classification };
}

/** Simpan asam urat (mg/dL). Ambang berbeda per jenis kelamin (disimpan di context). */
export async function logUricAcid(value: number, sex: Sex, note?: string): Promise<BiomarkerLogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const measuredAt = new Date();
  biomarkerReadingSchema.parse({ profileId, clientId, measuredAt, biomarker: "uric_acid", value, sex, note });

  const classification = classifyBiomarker({ biomarker: "uric_acid", value, sex }, DEFAULT_BIOMARKER_BANDS);
  const row: LocalBiomarkerReading = {
    clientId, profileId, biomarker: "uric_acid", context: sex,
    values: { value }, classification, measuredAt: measuredAt.toISOString(), note, deletedAt: null,
  };
  await db.transaction("rw", db.biomarker_readings, db.outbox, async () => {
    await db.biomarker_readings.put(row);
    await enqueue(clientId);
  });
  void flushOutbox();
  return { clientId, classification };
}

/** Tombstone (undo/hapus) — dipropagasi ke server seperti log lain. */
export async function undoBiomarker(clientId: string): Promise<void> {
  await db.transaction("rw", db.biomarker_readings, db.outbox, async () => {
    await db.biomarker_readings.update(clientId, { deletedAt: new Date().toISOString() });
    await enqueue(clientId);
  });
  void flushOutbox();
}

/** Pembacaan terbaru suatu biomarker MILIK PROFIL AKTIF (untuk Risk Panel). */
export async function latestReading(biomarker: "bp" | "glucose"): Promise<LocalBiomarkerReading | undefined> {
  const profileId = await getActiveProfileId();
  const rows = await db.biomarker_readings
    .where("[biomarker+measuredAt]")
    .between([biomarker, ""], [biomarker, "￿"])
    .reverse()
    .toArray();
  // filter profil aktif: pembacaan anggota keluarga (profileId lain) TIDAK bocor ke sini
  return rows.find((r) => !r.deletedAt && r.profileId === profileId);
}

/** Riwayat suatu biomarker MILIK PROFIL AKTIF (terbaru dulu), untuk trend/daftar. */
export async function readingHistory(
  biomarker: LocalBiomarkerReading["biomarker"], limit = 30,
): Promise<LocalBiomarkerReading[]> {
  const profileId = await getActiveProfileId();
  const rows = await db.biomarker_readings
    .where("[biomarker+measuredAt]")
    .between([biomarker, ""], [biomarker, "￿"])
    .reverse()
    .filter((r) => !r.deletedAt && r.profileId === profileId)
    .toArray();
  return rows.slice(0, limit);
}

/** Cast klasifikasi ter-cache (unknown di Dexie) ke tipe engine. */
export const asClassification = (v: unknown): BiomarkerClassification | null =>
  (v as BiomarkerClassification) ?? null;
