/**
 * Laporan Puasa untuk dokter (Fase 9 · manfaat Paket Ramadan #2). Engine MURNI & deterministik:
 * rekap catatan mandiri selama Ramadan yang relevan bagi dokter pasien kondisi kronis —
 * gula darah & tekanan darah SAAT JAM PUASA vs DI LUAR jam puasa, hitungan pembacaan di ambang
 * kegawatan aplikasi (RED_FLAG_THRESHOLDS, sama dgn Silent Killer Guard — tidak mengarang ambang
 * baru), dosis obat yang jatuh di jam puasa, kepatuhan, dan perubahan berat badan.
 *
 * NON-DIAGNOSIS: "Poin untuk didiskusikan" hanya fakta terhitung, tanpa interpretasi/anjuran.
 * Laporan ini PRIBADI (dibawa ke dokter) → hari tak berpuasa boleh ditampilkan apa adanya,
 * tanpa alasan (alasan tak pernah ditanya).
 */

import { RED_FLAG_THRESHOLDS } from "../biomarker.ts";
import type { RamadanWrapped } from "./ramadan-wrapped.ts";

export interface FastingGlucoseReading { date: string; value: number; duringFast: boolean } // date = tanggal LOKAL "YYYY-MM-DD"
export interface FastingBpReading { date: string; systolic: number; diastolic: number; duringFast: boolean }
export interface FastingWeight { date: string; atISO: string; kg: number } // atISO utk urutan
export interface FastingMedication {
  name: string;
  times: string[];          // jadwal "HH:MM"
  conflictTimes: string[];  // jadwal yang jatuh di jam puasa (imsak–maghrib)
  adherencePct: number | null;
}

export interface FastingReportInput {
  startDate: string;        // "YYYY-MM-DD"
  endDate: string;          // "YYYY-MM-DD" (sudah dijepit ke hari ini oleh pemanggil)
  wrapped: RamadanWrapped;
  patientName?: string;
  conditions: string[];     // label kondisi yang dipantau
  glucose: FastingGlucoseReading[];
  bp: FastingBpReading[];
  weights: FastingWeight[];
  medications: FastingMedication[];
  generatedAtISO: string;
}

export interface ValueStat { count: number; min: number; max: number; avg: number }
export interface BpStat { count: number; avgSys: number; avgDia: number; maxSys: number; maxDia: number }

export interface FastingReport {
  startDate: string;
  endDate: string;
  patientName?: string;
  conditions: string[];
  days: { total: number; fasted: number; notFasted: number };
  glucose: { duringFast: ValueStat | null; outsideFast: ValueStat | null; lowDuringFast: number; highDuringFast: number } | null;
  bp: { duringFast: BpStat | null; outsideFast: BpStat | null; crisisCount: number } | null;
  weight: { startKg: number; endKg: number; deltaKg: number } | null;
  medications: FastingMedication[];
  discussionPoints: string[];
  isEmpty: boolean;
  generatedAtISO: string;
  disclaimer: string;
}

export const FASTING_REPORT_DISCLAIMER =
  "Ringkasan catatan mandiri pasien selama Ramadan, dibuat otomatis oleh aplikasi — bukan diagnosis " +
  "dan bukan pengganti pemeriksaan. \"Jam puasa\" = imsak hingga maghrib menurut perhitungan aplikasi " +
  `pada hari yang ditandai berpuasa. Ambang hitungan: gula darah < ${RED_FLAG_THRESHOLDS.glucoseLow} atau ` +
  `≥ ${RED_FLAG_THRESHOLDS.glucoseHigh} mg/dL; tekanan darah ≥ ${RED_FLAG_THRESHOLDS.bpSystolic}/` +
  `${RED_FLAG_THRESHOLDS.bpDiastolic} mmHg. Akurasi bergantung pada alat ukur & pencatatan pasien.`;

/** Kepatuhan di bawah ini dimunculkan sebagai poin diskusi. */
export const FASTING_ADHERENCE_NOTE_BELOW = 80;
/** Perubahan berat (kg, absolut) yang dimunculkan sebagai poin diskusi. */
export const FASTING_WEIGHT_NOTE_KG = 2;

const r1 = (v: number): number => Math.round(v * 10) / 10;

function valueStat(values: number[]): ValueStat | null {
  if (!values.length) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return { count: values.length, min: Math.min(...values), max: Math.max(...values), avg: Math.round(sum / values.length) };
}

function bpStat(rows: FastingBpReading[]): BpStat | null {
  if (!rows.length) return null;
  const avg = (k: "systolic" | "diastolic") => Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length);
  return {
    count: rows.length, avgSys: avg("systolic"), avgDia: avg("diastolic"),
    maxSys: Math.max(...rows.map((r) => r.systolic)), maxDia: Math.max(...rows.map((r) => r.diastolic)),
  };
}

const inRange = (d: string, start: string, end: string): boolean => d >= start && d <= end;

export function buildFastingReport(input: FastingReportInput): FastingReport {
  const { startDate, endDate } = input;
  const T = RED_FLAG_THRESHOLDS;

  const glu = input.glucose.filter((g) => inRange(g.date, startDate, endDate));
  const gDuring = glu.filter((g) => g.duringFast).map((g) => g.value);
  const gOutside = glu.filter((g) => !g.duringFast).map((g) => g.value);
  const glucose = glu.length ? {
    duringFast: valueStat(gDuring),
    outsideFast: valueStat(gOutside),
    lowDuringFast: gDuring.filter((v) => v < T.glucoseLow).length,
    highDuringFast: gDuring.filter((v) => v >= T.glucoseHigh).length,
  } : null;

  const bpRows = input.bp.filter((b) => inRange(b.date, startDate, endDate));
  const bp = bpRows.length ? {
    duringFast: bpStat(bpRows.filter((b) => b.duringFast)),
    outsideFast: bpStat(bpRows.filter((b) => !b.duringFast)),
    crisisCount: bpRows.filter((b) => b.systolic >= T.bpSystolic || b.diastolic >= T.bpDiastolic).length,
  } : null;

  const w = input.weights.filter((x) => inRange(x.date, startDate, endDate))
    .sort((a, b) => a.atISO.localeCompare(b.atISO));
  const weight = w.length >= 2
    ? { startKg: w[0]!.kg, endKg: w[w.length - 1]!.kg, deltaKg: r1(w[w.length - 1]!.kg - w[0]!.kg) }
    : null;

  const points: string[] = [];
  if (glucose?.lowDuringFast) points.push(`${glucose.lowDuringFast} pembacaan gula darah < ${T.glucoseLow} mg/dL saat jam puasa.`);
  if (glucose?.highDuringFast) points.push(`${glucose.highDuringFast} pembacaan gula darah ≥ ${T.glucoseHigh} mg/dL saat jam puasa.`);
  if (bp?.crisisCount) points.push(`${bp.crisisCount} pembacaan tekanan darah ≥ ${T.bpSystolic}/${T.bpDiastolic} mmHg.`);
  for (const m of input.medications) {
    if (m.conflictTimes.length) points.push(`${m.name} terjadwal pada jam puasa (${m.conflictTimes.join(", ")}).`);
  }
  for (const m of input.medications) {
    if (m.adherencePct != null && m.adherencePct < FASTING_ADHERENCE_NOTE_BELOW) {
      points.push(`Kepatuhan ${m.name} ${m.adherencePct}% selama periode ini.`);
    }
  }
  if (weight && Math.abs(weight.deltaKg) >= FASTING_WEIGHT_NOTE_KG) {
    points.push(`Berat badan berubah ${weight.deltaKg > 0 ? "+" : ""}${weight.deltaKg} kg selama periode ini.`);
  }

  const days = { total: input.wrapped.totalDays, fasted: input.wrapped.fastedDays, notFasted: input.wrapped.missedDays };
  return {
    startDate, endDate,
    patientName: input.patientName,
    conditions: input.conditions,
    days,
    glucose, bp, weight,
    medications: input.medications,
    discussionPoints: points,
    isEmpty: days.total === 0,
    generatedAtISO: input.generatedAtISO,
    disclaimer: FASTING_REPORT_DISCLAIMER,
  };
}

/** Apakah menit-dalam-hari jatuh di jam puasa [imsak, maghrib). */
export const isDuringFastMinute = (minuteOfDay: number, imsakMin: number, maghribMin: number): boolean =>
  minuteOfDay >= imsakMin && minuteOfDay < maghribMin;
