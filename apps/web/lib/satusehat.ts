"use client";
import {
  buildFhirBundle, summarizeBundle, type FhirBundle, type FhirBiomarkerInput, type FhirMedicationInput,
} from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";

/**
 * SATUSEHAT / FHIR (backlog · SS-1) — rakit Bundle FHIR R4 dari Dexie profil aktif (biomarker
 * + obat + identitas) via engine murni @arta/core, lalu ekspor sebagai berkas .json. OFFLINE:
 * berkas dibuat DI PERANGKAT (Blob), tak ada unggah. Sinkronisasi jaringan SATUSEHAT (SS-2)
 * butuh kredensial organisasi → menyusul. Data kesehatan T1 (tak pernah di-log). Non-diagnosis.
 */

/** Bangun Bundle FHIR dari data profil aktif (subjek = "Saya"). */
export async function buildProfileBundle(nowMs = Date.now()): Promise<FhirBundle> {
  const pid = await getActiveProfileId();
  const [members, readings, meds, nameMeta] = await Promise.all([
    db.family_members.toArray(),
    db.biomarker_readings.toArray(),
    db.medications.toArray(),
    db.meta.get("displayName"),
  ]);
  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]): T[] =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);

  const subject = members.find((m) => m.id === pid && !m.deletedAt)
    ?? members.find((m) => m.isSelf && !m.deletedAt);

  const biomarkers: FhirBiomarkerInput[] = mine(readings).map((r) => ({
    biomarker: r.biomarker, context: r.context ?? null,
    values: r.values as Record<string, number>, measuredAt: r.measuredAt,
  }));
  const medications: FhirMedicationInput[] = mine(meds).map((m) => ({
    name: m.name, dosage: m.dosage ?? null, isActive: m.isActive, since: m.createdAt ?? null,
  }));

  return buildFhirBundle({
    patient: {
      name: subject?.displayName ?? nameMeta?.value ?? null,
      sex: subject?.sex ?? null,
      birthDate: subject?.dob ?? null,
    },
    biomarkers, medications,
    timestamp: new Date(nowMs).toISOString(),
  });
}

/** Ringkasan jumlah resource per jenis (untuk pratinjau kartu). */
export async function bundleSummary(nowMs = Date.now()): Promise<{ counts: Record<string, number>; total: number }> {
  const bundle = await buildProfileBundle(nowMs);
  const counts = summarizeBundle(bundle);
  return { counts, total: bundle.entry.length };
}

/** Unduh Bundle FHIR sebagai berkas .json (di perangkat; tanpa unggah). */
export async function downloadFhirBundle(nowMs = Date.now()): Promise<void> {
  const bundle = await buildProfileBundle(nowMs);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date(nowMs).toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `artahealth-fhir-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
