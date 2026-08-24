"use client";
import { findCorrelations, type Correlation, type DailyMetricPoint } from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";

/**
 * Laporan bulanan + korelasi lintas-metrik (V3-3). Susun deret harian per metrik dari
 * Dexie (profil aktif, 30 hari) → rata-rata bulanan + korelasi deterministik (engine core).
 * Pola, bukan sebab-akibat. Tanpa tabel baru.
 */

const WINDOW_DAYS = 30;

export const METRIC_LABELS: Record<string, string> = {
  sleep: "durasi tidur", hydration: "hidrasi", steps: "langkah harian", mood: "mood",
};
const METRIC_UNIT: Record<string, string> = { sleep: "jam", hydration: "ml", steps: "langkah", mood: "/5" };

const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Jumlahkan nilai per hari lokal. */
function sumByDay(rows: { iso: string; value: number }[]): DailyMetricPoint[] {
  const m = new Map<string, number>();
  for (const r of rows) if (Number.isFinite(r.value)) m.set(localDay(r.iso), (m.get(localDay(r.iso)) ?? 0) + r.value);
  return [...m.entries()].map(([day, value]) => ({ day, value }));
}
/** Rata-ratakan nilai per hari lokal (mis. mood). */
function avgByDay(rows: { iso: string; value: number }[]): DailyMetricPoint[] {
  const acc = new Map<string, { s: number; n: number }>();
  for (const r of rows) {
    if (!Number.isFinite(r.value)) continue;
    const k = localDay(r.iso); const a = acc.get(k) ?? { s: 0, n: 0 };
    a.s += r.value; a.n += 1; acc.set(k, a);
  }
  return [...acc.entries()].map(([day, a]) => ({ day, value: a.s / a.n }));
}

export interface MonthlyMetric { key: string; label: string; unit: string; avg: number; days: number; }
export interface MonthlyInsight {
  rangeDays: number;
  metrics: MonthlyMetric[];
  correlations: Correlation[];
  labels: Record<string, string>;
}

const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

export async function monthlyInsight(days = WINDOW_DAYS, nowMs = Date.now()): Promise<MonthlyInsight> {
  const pid = await getActiveProfileId();
  const fromMs = nowMs - days * 86_400_000;
  const inWin = (iso: string | null | undefined): boolean => !!iso && new Date(iso).getTime() >= fromMs;
  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]) =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);

  const [sleeps, hydr, acts, moods] = await Promise.all([
    db.sleep_logs.toArray(), db.hydration_logs.toArray(), db.activity_logs.toArray(), db.mood_logs.toArray(),
  ]);

  const sleepSeries = sumByDay(mine(sleeps).filter((s) => inWin(s.sleepEnd)).map((s) => ({
    iso: s.sleepEnd, value: (new Date(s.sleepEnd).getTime() - new Date(s.sleepStart).getTime()) / 3_600_000,
  })).filter((r) => r.value > 0 && r.value < 24));
  const hydrationSeries = sumByDay(mine(hydr).filter((h) => inWin(h.loggedAt)).map((h) => ({ iso: h.loggedAt, value: h.volumeMl ?? 0 })));
  const stepsSeries = sumByDay(mine(acts).filter((a) => inWin(a.loggedAt)).map((a) => ({ iso: a.loggedAt, value: a.steps ?? 0 })));
  const moodSeries = avgByDay(mine(moods).filter((m) => inWin(m.loggedAt)).map((m) => ({ iso: m.loggedAt, value: m.mood })));

  const series: Record<string, DailyMetricPoint[]> = {
    sleep: sleepSeries, hydration: hydrationSeries, steps: stepsSeries, mood: moodSeries,
  };

  const metrics: MonthlyMetric[] = Object.entries(series)
    .filter(([, s]) => s.length > 0)
    .map(([key, s]) => ({
      key, label: METRIC_LABELS[key] ?? key, unit: METRIC_UNIT[key] ?? "",
      avg: Math.round(mean(s.map((p) => p.value)) * 10) / 10, days: s.length,
    }));

  const correlations = findCorrelations(series, { minPairs: 8, minAbsR: 0.4, top: 3 });
  return { rangeDays: days, metrics, correlations, labels: METRIC_LABELS };
}
