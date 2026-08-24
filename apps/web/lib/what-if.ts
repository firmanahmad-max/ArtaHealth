"use client";
import type { DayInputs } from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";

/**
 * Simulasi "Bagaimana Jika" (V3-2) — susun baseline "hari khas" dari rata-rata terkini
 * profil aktif (default 14 hari) untuk diproyeksikan engine what-if core. Faktor tanpa
 * data pakai asumsi netral agar simulator tetap bisa dijelajahi (framing: hari khas).
 */

const WINDOW_DAYS = 14;

const mean = (a: number[]): number | null => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const distinctDays = (isos: string[]): number => new Set(isos.map((s) => s.slice(0, 10))).size;

export async function whatIfBaseline(days = WINDOW_DAYS, nowMs = Date.now()): Promise<DayInputs> {
  const pid = await getActiveProfileId();
  const fromMs = nowMs - days * 86_400_000;
  const inWin = (iso: string | null | undefined): boolean => !!iso && new Date(iso).getTime() >= fromMs;

  const [sleeps, hydr, acts, moods, hMl, hSteps] = await Promise.all([
    db.sleep_logs.toArray(), db.hydration_logs.toArray(), db.activity_logs.toArray(),
    db.mood_logs.toArray(), db.meta.get("targetHydrationMl"), db.meta.get("targetSteps"),
  ]);
  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]) =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);

  const targetMl = Number(hMl?.value) || 2500;
  const stepTarget = Number(hSteps?.value) || 8000;

  // Tidur: rata-rata jam/malam (menit); default 360 (6 jam) bila tak ada data.
  const sleepMins = mine(sleeps).filter((s) => inWin(s.sleepEnd))
    .map((s) => (new Date(s.sleepEnd).getTime() - new Date(s.sleepStart).getTime()) / 60000)
    .filter((m) => m > 0 && m < 24 * 60);
  const sleepAvg = mean(sleepMins);

  // Hidrasi: rata-rata ml/hari.
  const hRows = mine(hydr).filter((h) => inWin(h.loggedAt));
  const hDays = distinctDays(hRows.map((h) => h.loggedAt));
  const hydrAvg = hDays > 0 ? hRows.reduce((s, h) => s + (h.volumeMl ?? 0), 0) / hDays : null;

  // Aktivitas: rata-rata langkah/hari & menit olahraga/hari.
  const aRows = mine(acts).filter((a) => inWin(a.loggedAt));
  const aDays = distinctDays(aRows.map((a) => a.loggedAt));
  const stepsAvg = aDays > 0 ? aRows.reduce((s, a) => s + (a.steps ?? 0), 0) / aDays : null;
  const exAvg = aDays > 0 ? aRows.reduce((s, a) => s + (a.durationMin ?? 0), 0) / aDays : null;

  // Mood: rata-rata terkini (1–5) dibulatkan.
  const moodAvg = mean(mine(moods).filter((m) => inWin(m.loggedAt)).map((m) => m.mood));

  const clampMood = (v: number): 1 | 2 | 3 | 4 | 5 =>
    Math.min(5, Math.max(1, Math.round(v))) as 1 | 2 | 3 | 4 | 5;

  return {
    sleep: { durationMin: Math.round(sleepAvg ?? 360) },
    hydration: { intakeMl: Math.round(hydrAvg ?? 0), targetMl },
    activity: { steps: Math.round(stepsAvg ?? 0), stepTarget, exerciseMin: Math.round(exAvg ?? 0) },
    mood: clampMood(moodAvg ?? 3),
  };
}
