"use client";
import {
  classifyBiomarker, DEFAULT_BIOMARKER_BANDS,
  type BiomarkerInput, type BiomarkerClassification, type Biomarker, type Zone,
} from "@arta/core";
import { db, type LocalBiomarkerReading } from "./db";

/**
 * Family Health — pantau biomarker anggota (Fase 6 · FM-2). Catat & lihat pembacaan
 * biomarker milik anggota keluarga (profileId = id anggota). Klasifikasi deterministik
 * (engine Fase 2), sama seperti pencatatan diri.
 *
 * FM-4b: reading anggota DI-ENQUEUE → sync ke server. Aman karena urutan tick
 * (syncProfiles→flushOutbox): profil anggota di-push lebih dulu (FK). Bila profil
 * belum ter-push, push reading gagal & self-heal di tick berikutnya (setelah profil ada).
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
  await db.transaction("rw", db.biomarker_readings, db.outbox, async () => {
    await db.biomarker_readings.put(row);
    await db.outbox.add({ table: "biomarker_readings", clientId: row.clientId, attempts: 0, queuedAt: new Date().toISOString() });
  });
  // TIDAK flush langsung: biar tick loop (syncProfiles→flushOutbox) push setelah profil anggota ada (FK)
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

// ===== FM-3: status & alert caregiver =====

const ZONE_RANK: Record<Zone, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

export interface MemberHealthStatus {
  /** zona terburuk dari pembacaan terbaru tiap biomarker (null bila belum ada data) */
  zone: Zone | null;
  redFlag: boolean;
  /** biomarker zona oranye/merah yang perlu perhatian */
  concerns: { biomarker: Biomarker; label: string; zone: Zone }[];
}

/** Status kesehatan ringkas satu anggota dari pembacaan terbaru per biomarker. */
export async function memberStatus(memberId: string): Promise<MemberHealthStatus> {
  const latest = await memberLatest(memberId);
  let zone: Zone | null = null;
  let redFlag = false;
  const concerns: MemberHealthStatus["concerns"] = [];
  for (const r of Object.values(latest)) {
    const c = r?.classification as BiomarkerClassification | null;
    if (!c) continue;
    if (c.redFlag) redFlag = true;
    if (zone === null || ZONE_RANK[c.zone] > ZONE_RANK[zone]) zone = c.zone;
    if (c.zone === "orange" || c.zone === "red") concerns.push({ biomarker: r!.biomarker, label: c.band.label, zone: c.zone });
  }
  return { zone, redFlag, concerns };
}

/** Status seluruh anggota (untuk rollup keluarga). */
export async function familyOverview(memberIds: string[]): Promise<Record<string, MemberHealthStatus>> {
  const out: Record<string, MemberHealthStatus> = {};
  for (const id of memberIds) out[id] = await memberStatus(id);
  return out;
}
