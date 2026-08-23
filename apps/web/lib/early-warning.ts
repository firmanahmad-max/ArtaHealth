"use client";
import {
  detectEarlyWarning, type EWPoint, type EWResult, type EWDirection,
} from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";

/**
 * Early Warning (Fase 6 #4) — turunkan deret waktu tiap metrik dari Dexie (profil aktif),
 * jalankan engine z-score deterministik, hasilkan peringatan geseran terhadap baseline
 * PRIBADI. Melengkapi Panel Risiko (ambang absolut). Bukan diagnosis — hanya "layak dicek".
 * Data anggota keluarga (profil lain) TAK ikut (difilter profil aktif).
 */

/** Arah yang dianggap layak-diperingatkan untuk suatu metrik. */
type Concern = EWDirection | "both";

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  icon: string;
  concerning: Concern;
  /** Deret {t,value} profil aktif (belum tentu terurut — engine menyaring sendiri). */
  series: (pid: string) => Promise<EWPoint[]>;
  /** Pesan non-diagnostik saat anomali (arah tertentu). */
  message: (dir: EWDirection) => string;
}

const active = <T extends { profileId: string; deletedAt: string | null }>(rows: T[], pid: string) =>
  rows.filter((r) => r.profileId === pid && !r.deletedAt);

/** Ambil nilai biomarker (profil aktif) sebagai deret waktu via measuredAt. */
async function biomarkerSeries(
  pid: string,
  match: (r: { biomarker: string; context: string | null }) => boolean,
  pick: (v: Record<string, number>) => number | undefined,
): Promise<EWPoint[]> {
  const rows = active(await db.biomarker_readings.toArray(), pid);
  const out: EWPoint[] = [];
  for (const r of rows) {
    if (!match(r)) continue;
    const v = pick(r.values);
    if (typeof v === "number" && Number.isFinite(v)) out.push({ t: r.measuredAt, value: v });
  }
  return out;
}

export const EW_METRICS: MetricDef[] = [
  {
    key: "weight", label: "Berat badan", unit: "kg", icon: "⚖️", concerning: "both",
    series: async (pid) =>
      active(await db.weight_logs.toArray(), pid).map((r) => ({ t: r.loggedAt, value: r.weightKg })),
    message: (d) => d === "rising"
      ? "Berat badan tren naik dari biasanya — perhatikan pola makan & aktivitas."
      : "Berat badan turun cukup cepat dari biasanya — pastikan asupan cukup; cek bila tak disengaja.",
  },
  {
    key: "systolic", label: "Tekanan darah (sistolik)", unit: "mmHg", icon: "🫀", concerning: "rising",
    series: (pid) => biomarkerSeries(pid, (r) => r.biomarker === "bp", (v) => v.systolic),
    message: () => "Tekanan darah cenderung naik dari normamu — pertimbangkan ukur lebih rutin & kurangi garam.",
  },
  {
    key: "glucose_gdp", label: "Gula darah puasa", unit: "mg/dL", icon: "🩸", concerning: "rising",
    series: (pid) => biomarkerSeries(pid, (r) => r.biomarker === "glucose" && r.context === "gdp", (v) => v.value),
    message: () => "Gula darah puasa tren naik dari biasanya — jaga asupan gula; konsultasi bila berlanjut.",
  },
  {
    key: "uric_acid", label: "Asam urat", unit: "mg/dL", icon: "🦴", concerning: "rising",
    series: (pid) => biomarkerSeries(pid, (r) => r.biomarker === "uric_acid", (v) => v.value),
    message: () => "Asam urat tren naik dari biasanya — perhatikan makanan tinggi purin & cukupi cairan.",
  },
  {
    key: "sleep_hours", label: "Durasi tidur", unit: "jam", icon: "🌙", concerning: "falling",
    series: async (pid) => {
      const rows = active(await db.sleep_logs.toArray(), pid);
      const out: EWPoint[] = [];
      for (const r of rows) {
        const hrs = (new Date(r.sleepEnd).getTime() - new Date(r.sleepStart).getTime()) / 3_600_000;
        if (Number.isFinite(hrs) && hrs > 0 && hrs < 24) out.push({ t: r.sleepEnd, value: hrs });
      }
      return out;
    },
    message: () => "Durasi tidur menurun dari biasanya — kurang tidur menekan pemulihan & mood.",
  },
];

export interface EarlyWarning {
  metric: MetricDef;
  result: EWResult;
  message: string;
}

const SEVERITY_RANK: Record<string, number> = { alert: 0, watch: 1, none: 2 };

/** Metrik yang sedang membangun baseline (data belum cukup) — untuk konteks UI. */
export interface EWMonitoring {
  metric: MetricDef;
  baselineN: number;
  needed: number;
}

export interface EarlyWarningReport {
  warnings: EarlyWarning[];
  monitoring: EWMonitoring[];   // metrik dengan data (>0) tapi belum cukup baseline
  nowMs: number;
}

/** Susun laporan Early Warning untuk profil aktif (atau profil tertentu, mis. anggota keluarga). */
export async function earlyWarningReport(nowMs: number = Date.now(), profileId?: string): Promise<EarlyWarningReport> {
  const pid = profileId ?? await getActiveProfileId();
  const warnings: EarlyWarning[] = [];
  const monitoring: EWMonitoring[] = [];

  for (const metric of EW_METRICS) {
    const points = await metric.series(pid);
    const result = detectEarlyWarning(points, nowMs);
    if (result.status === "anomaly") {
      const relevant = metric.concerning === "both" || metric.concerning === result.direction;
      if (relevant) warnings.push({ metric, result, message: metric.message(result.direction) });
    } else if (result.status === "insufficient" && points.length > 0) {
      monitoring.push({ metric, baselineN: result.baselineN, needed: 10 }); // DEFAULT_EW_CONFIG.minBaseline
    }
  }

  warnings.sort((a, b) => SEVERITY_RANK[a.result.severity]! - SEVERITY_RANK[b.result.severity]!);
  return { warnings, monitoring, nowMs };
}
