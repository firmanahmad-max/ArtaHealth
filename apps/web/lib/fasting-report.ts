"use client";
import {
  buildFastingReport, isDuringFastMinute, fastingScheduleConflicts, adherencePct, CONDITION_LABEL_ID,
  type FastingReport, type FastingGlucoseReading, type FastingBpReading, type FastingMedication,
} from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";
import { getFastingSettings, prayerTimesFor } from "./fasting";
import { ramadanWrappedData } from "./ramadan-wrapped";

/**
 * Laporan Puasa untuk dokter (Fase 9 · manfaat Paket Ramadan #2) — rakit dari Dexie profil aktif
 * untuk rentang Ramadan (dijepit ke hari ini), lalu engine deterministik @arta/core. On-device.
 * "Jam puasa" = [imsak, maghrib) pada hari yang TIDAK ditandai not_fasting (default puasa).
 */

const localKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const keyToDate = (k: string): Date => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};

/** Laporan bisa dibuat? (rentang Ramadan diatur & sudah dimulai) — untuk menyembunyikan kartu. */
export async function fastingReportAvailable(now = new Date()): Promise<boolean> {
  const s = await getFastingSettings();
  return !!s.ramadanStart && !!s.ramadanEnd && localKey(now) >= s.ramadanStart;
}

/** null bila rentang Ramadan belum diatur atau belum dimulai. */
export async function fastingReport(now = new Date()): Promise<FastingReport | null> {
  const s = await getFastingSettings();
  if (!s.ramadanStart || !s.ramadanEnd) return null;
  const today = localKey(now);
  if (today < s.ramadanStart) return null;
  const startDate = s.ramadanStart;
  const endDate = s.ramadanEnd < today ? s.ramadanEnd : today;

  const wrapped = await ramadanWrappedData(today);
  if (!wrapped) return null;
  const pid = await getActiveProfileId();

  const [days, readings, weights, meds, intakes, conditions, members] = await Promise.all([
    db.fasting_days.toArray(),
    db.biomarker_readings.toArray(),
    db.weight_logs.toArray(),
    db.medications.toArray(),
    db.medication_intakes.toArray(),
    db.monitored_conditions.toArray(),
    db.family_members.toArray(),
  ]);
  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]) =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);
  const inRange = (k: string) => k >= startDate && k <= endDate;

  const notFasting = new Set(days.filter((d) => d.profileId === pid && d.status === "not_fasting").map((d) => d.date));

  // Waktu imsak/maghrib per tanggal (cache) — hanya hari berpuasa yang punya "jam puasa".
  const pt = new Map<string, { imsak: number; maghrib: number }>();
  const windowFor = async (k: string) => {
    if (!pt.has(k)) { const t = await prayerTimesFor(keyToDate(k)); pt.set(k, { imsak: t.imsak, maghrib: t.maghrib }); }
    return pt.get(k)!;
  };
  const duringFast = async (iso: string): Promise<{ date: string; during: boolean }> => {
    const d = new Date(iso);
    const k = localKey(d);
    if (notFasting.has(k) || !inRange(k)) return { date: k, during: false };
    const w = await windowFor(k);
    return { date: k, during: isDuringFastMinute(d.getHours() * 60 + d.getMinutes(), w.imsak, w.maghrib) };
  };

  const glucose: FastingGlucoseReading[] = [];
  const bp: FastingBpReading[] = [];
  for (const r of mine(readings)) {
    const k = localKey(new Date(r.measuredAt));
    if (!inRange(k)) continue;
    if (r.biomarker === "glucose" && r.context !== "hba1c" && typeof r.values.value === "number") {
      const f = await duringFast(r.measuredAt);
      glucose.push({ date: f.date, value: r.values.value, duringFast: f.during });
    } else if (r.biomarker === "bp" && typeof r.values.systolic === "number" && typeof r.values.diastolic === "number") {
      const f = await duringFast(r.measuredAt);
      bp.push({ date: f.date, systolic: r.values.systolic, diastolic: r.values.diastolic, duringFast: f.during });
    }
  }

  // Obat: konflik dihitung dgn jadwal salat hari terakhir rentang (berubah ±menit sepanjang bulan).
  const ref = await windowFor(endDate);
  const myIntakes = mine(intakes).filter((i) => inRange(localKey(new Date(i.scheduledAt))));
  const medications: FastingMedication[] = mine(meds).filter((m) => m.isActive).map((m) => {
    const forMed = myIntakes.filter((i) => i.medicationId === m.id);
    return {
      name: m.dosage ? `${m.name} (${m.dosage})` : m.name,
      times: m.schedule?.times ?? [],
      conflictTimes: fastingScheduleConflicts(m.schedule?.times ?? [], ref.imsak, ref.maghrib),
      adherencePct: adherencePct(forMed.length, forMed.filter((i) => i.status === "taken").length),
    };
  });

  const self = members.find((m) => m.id === pid && !m.deletedAt) ?? members.find((m) => m.isSelf && !m.deletedAt);
  const name = self?.displayName ?? (await db.meta.get("displayName"))?.value;

  return buildFastingReport({
    startDate, endDate, wrapped,
    patientName: name ?? undefined,
    conditions: mine(conditions).filter((c) => c.status !== "resolved").map((c) => CONDITION_LABEL_ID[c.condition] ?? c.condition),
    glucose, bp,
    weights: mine(weights).map((w) => ({ date: localKey(new Date(w.loggedAt)), atISO: w.loggedAt, kg: w.weightKg })),
    medications,
    generatedAtISO: now.toISOString(),
  });
}
