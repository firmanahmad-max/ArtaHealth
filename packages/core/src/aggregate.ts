// ekstensi .ts eksplisit: file ini ikut di-bundle Edge Function (Deno) — lihat supabase/functions/daily-score
import type { DayInputs } from "./scoring/health-score.ts";

/**
 * Agregasi log satu hari → DayInputs untuk scoring engine.
 * Dipakai Dashboard (live, dari IndexedDB) dan Edge Function daily_scores (dari Postgres)
 * agar keduanya menghitung dengan aturan yang sama persis.
 */

export interface DayLogs {
  hydration?: { volumeMl: number }[];
  /** tidur yang BERAKHIR pada hari target; sesi terpanjang dianggap tidur utama */
  sleep?: { sleepStart: string | Date; sleepEnd: string | Date }[];
  activity?: { durationMin?: number | null; steps?: number | null }[];
  mood?: { mood: number; loggedAt: string | Date }[];
  habits?: { completed: number; total: number };
}

export interface DayTargets {
  hydrationMl: number;
  steps: number;
}

const toMs = (d: string | Date) => (d instanceof Date ? d : new Date(d)).getTime();

export function aggregateDayInputs(logs: DayLogs, targets: DayTargets): DayInputs {
  const inputs: DayInputs = {};

  if (logs.hydration && logs.hydration.length > 0) {
    const intakeMl = logs.hydration.reduce((s, l) => s + l.volumeMl, 0);
    inputs.hydration = { intakeMl, targetMl: targets.hydrationMl };
  }

  if (logs.sleep && logs.sleep.length > 0) {
    const durationMin = Math.max(
      ...logs.sleep.map((l) => Math.round((toMs(l.sleepEnd) - toMs(l.sleepStart)) / 60000)),
    );
    if (durationMin > 0) inputs.sleep = { durationMin };
  }

  if (logs.activity && logs.activity.length > 0) {
    const stepLogs = logs.activity.filter((l) => l.steps != null);
    const steps = stepLogs.length > 0 ? stepLogs.reduce((s, l) => s + (l.steps as number), 0) : undefined;
    const durSum = logs.activity.reduce((s, l) => s + (l.durationMin ?? 0), 0);
    const exerciseMin = durSum > 0 ? durSum : undefined;
    if (steps !== undefined || exerciseMin !== undefined) {
      inputs.activity = { steps, stepTarget: targets.steps, exerciseMin };
    }
  }

  if (logs.mood && logs.mood.length > 0) {
    const latest = [...logs.mood].sort((a, b) => toMs(b.loggedAt) - toMs(a.loggedAt))[0]!;
    const m = Math.round(latest.mood);
    if (m >= 1 && m <= 5) inputs.mood = m as DayInputs["mood"];
  }

  if (logs.habits && logs.habits.total > 0) inputs.habits = logs.habits;

  return inputs;
}
