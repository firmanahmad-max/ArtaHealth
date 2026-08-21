"use client";
import {
  classifyBiomarker, DEFAULT_BIOMARKER_BANDS, extractedLabSchema, resolveLabValues,
  type BiomarkerInput, type LabFinding, type ExtractedLab, type LabSanityIssue, type Sex,
} from "@arta/core";
import { db, type LocalBiomarkerReading, type LocalMedicalDocument } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";
import { getSupabase } from "./supabase";

/**
 * Medical Vault OCR (Fase 6 · MV-3). Panggil Edge Function `vault-scan` (vision OCR
 * hasil lab); KLASIFIKASI tetap deterministik (engine biomarker Fase 2). Nilai
 * dikonfirmasi user → biomarker_readings (source='vault_ocr') + medical_documents.
 * Turun anggun saat lokal/offline/belum-deploy (jalur isi-manual tetap jalan).
 * ⚠️ vault-scan BELUM deploy → jalur foto runtime-untested s/d launch.
 */

export type ScanLabResult =
  | { ok: true; extracted: ExtractedLab; sanity: LabSanityIssue[] }
  | { ok: false; reason: "unavailable" | "not_a_lab" | "error"; message: string };

const LOCAL = "00000000-0000-4000-8000-000000000000";

export async function scanLab(imageDataUrl: string): Promise<ScanLabResult> {
  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (!supabase || profileId === LOCAL || !online) {
    return { ok: false, reason: "unavailable", message: "Pindai foto lab belum aktif di sesi ini — isi nilai manual dulu, ya." };
  }
  try {
    const { data, error } = await supabase.functions.invoke("vault-scan", { body: { imageUrl: imageDataUrl } });
    if (error) {
      const ctx = (error as { context?: { message?: string } })?.context;
      if (ctx?.message) return { ok: false, reason: "not_a_lab", message: ctx.message };
      return { ok: false, reason: "error", message: "Gagal membaca hasil lab. Coba lagi atau isi manual." };
    }
    const parsed = extractedLabSchema.safeParse((data as { extracted?: unknown })?.extracted);
    if (!parsed.success || resolveLabValues(parsed.data).length === 0) {
      return { ok: false, reason: "not_a_lab", message: "Kami tak menemukan nilai lab. Isi manual, ya." };
    }
    return { ok: true, extracted: parsed.data, sanity: (data as { sanity?: LabSanityIssue[] }).sanity ?? [] };
  } catch {
    return { ok: false, reason: "error", message: "Gagal membaca hasil lab. Coba lagi atau isi manual." };
  }
}

/** BiomarkerInput → bentuk penyimpanan reading (context + values) sesuai skema Fase 2. */
function shapeReading(input: BiomarkerInput): { context: string | null; values: Record<string, number> } {
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

function enqueue(table: "medical_documents" | "biomarker_readings", key: string): Promise<unknown> {
  return db.outbox.add({ table, clientId: key, attempts: 0, queuedAt: new Date().toISOString() });
}

/**
 * Simpan temuan lab terpilih: buat 1 dokumen Vault + tulis tiap pembacaan biomarker
 * (source='vault_ocr', tautan vault_doc_id). Dokumen di-enqueue lebih dulu (FK).
 * Kembalikan jumlah tersimpan.
 */
export async function saveLabFindings(
  findings: LabFinding[],
  opts: { extracted: unknown; docDate?: string | null; sex?: Sex },
): Promise<number> {
  if (findings.length === 0) return 0;
  const profileId = await getActiveProfileId();
  const docId = crypto.randomUUID();
  const now = new Date().toISOString();
  const doc: LocalMedicalDocument = {
    id: docId, profileId, kind: "lab", docDate: opts.docDate ?? null,
    extracted: opts.extracted, photoPath: null, scannedAt: now, deletedAt: null,
  };
  const readings: LocalBiomarkerReading[] = findings.map((f) => {
    const cls = classifyBiomarker(f.input, DEFAULT_BIOMARKER_BANDS);
    const { context, values } = shapeReading(f.input);
    return {
      clientId: crypto.randomUUID(), profileId, biomarker: f.biomarker, context,
      values, classification: cls, measuredAt: opts.docDate ? new Date(opts.docDate).toISOString() : now,
      source: "vault_ocr", vaultDocId: docId, deletedAt: null,
    };
  });
  await db.transaction("rw", db.medical_documents, db.biomarker_readings, db.outbox, async () => {
    await db.medical_documents.put(doc);
    await enqueue("medical_documents", docId);           // FK: dokumen dulu
    for (const r of readings) {
      await db.biomarker_readings.put(r);
      await enqueue("biomarker_readings", r.clientId);
    }
  });
  void flushOutbox();
  return readings.length;
}

/** Dokumen Vault aktif (terbaru dulu). */
export async function vaultDocuments(): Promise<LocalMedicalDocument[]> {
  const rows = await db.medical_documents.toArray();
  return rows.filter((r) => !r.deletedAt).sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}
