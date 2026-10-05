"use client";
import { ramadanReadiness, type RamadanReadiness } from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";
import { getFastingSettings } from "./fasting";
import { featureMedication } from "./features";

/**
 * Readiness pra-Ramadan (Fase 9 · RW-2) — tampil hanya PRA-MUSIM: Ramadan sudah diaktifkan (rentang
 * diatur) tapi belum mulai (hari ini < awal). Hitung countdown + sinyal persiapan dari settings +
 * obat, lalu jalankan engine deterministik @arta/core. null di luar jendela pra-musim. Non-medis.
 */
const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const daysBetween = (fromKey: string, toKey: string): number =>
  Math.round((new Date(`${toKey}T00:00:00`).getTime() - new Date(`${fromKey}T00:00:00`).getTime()) / 86_400_000);

export async function ramadanReadinessData(): Promise<RamadanReadiness | null> {
  const s = await getFastingSettings();
  if (!s.ramadanEnabled || !s.ramadanStart) return null;
  const today = todayKey();
  if (today >= s.ramadanStart) return null; // sudah mulai → kartu aktif yang ambil alih

  const pid = await getActiveProfileId();
  const medsOn = featureMedication();
  const hasMedications = medsOn
    ? (await db.medications.toArray()).some((m) => m.profileId === pid && m.isActive && !m.deletedAt)
    : false;

  return ramadanReadiness({
    daysUntilStart: daysBetween(today, s.ramadanStart),
    hasLocation: s.latitude != null && s.longitude != null,
    medicalAcknowledged: !!s.medicalAckAt,
    medicationModuleOn: medsOn,
    hasMedications,
  });
}
