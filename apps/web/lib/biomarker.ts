"use client";
import {
  classifyBiomarker, DEFAULT_BIOMARKER_BANDS,
  biomarkerReadingSchema,
  type BiomarkerClassification, type GlucoseContext,
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

/** Tombstone (undo/hapus) — dipropagasi ke server seperti log lain. */
export async function undoBiomarker(clientId: string): Promise<void> {
  await db.transaction("rw", db.biomarker_readings, db.outbox, async () => {
    await db.biomarker_readings.update(clientId, { deletedAt: new Date().toISOString() });
    await enqueue(clientId);
  });
  void flushOutbox();
}

/** Pembacaan terbaru suatu biomarker (untuk Risk Panel). */
export async function latestReading(biomarker: "bp" | "glucose"): Promise<LocalBiomarkerReading | undefined> {
  const rows = await db.biomarker_readings
    .where("[biomarker+measuredAt]")
    .between([biomarker, ""], [biomarker, "￿"])
    .reverse()
    .toArray();
  return rows.find((r) => !r.deletedAt);
}

/** Riwayat suatu biomarker (terbaru dulu), untuk trend/daftar. */
export async function readingHistory(
  biomarker: "bp" | "glucose", limit = 30,
): Promise<LocalBiomarkerReading[]> {
  const rows = await db.biomarker_readings
    .where("[biomarker+measuredAt]")
    .between([biomarker, ""], [biomarker, "￿"])
    .reverse()
    .filter((r) => !r.deletedAt)
    .toArray();
  return rows.slice(0, limit);
}

/** Cast klasifikasi ter-cache (unknown di Dexie) ke tipe engine. */
export const asClassification = (v: unknown): BiomarkerClassification | null =>
  (v as BiomarkerClassification) ?? null;
