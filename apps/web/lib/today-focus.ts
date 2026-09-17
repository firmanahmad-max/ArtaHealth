"use client";
import { todayFocus, type FocusItem } from "@arta/core";
import { db } from "./db";
import { getActiveProfileId, getTargets } from "./sync";
import { playerActivity, todayCounts } from "./gamification";

/**
 * Fokus Hari Ini (Fase 8 · KR-1) — rakit input dari Dexie profil aktif lalu jalankan mesin
 * deterministik @arta/core. Reuse gamification (streak/lifetime) + target hidrasi. Non-medis.
 */

const localDay = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayOf = (v: unknown): string | null => {
  if (!v) return null;
  const t = new Date(v as string).getTime();
  return Number.isNaN(t) ? null : localDay(t);
};

export async function todayFocusItems(nowMs = Date.now()): Promise<FocusItem[]> {
  const pid = await getActiveProfileId();
  const today = localDay(nowMs);
  const [hyd, slp, mood, act, targets, activity, counts] = await Promise.all([
    db.hydration_logs.toArray(), db.sleep_logs.toArray(), db.mood_logs.toArray(), db.activity_logs.toArray(),
    getTargets(), playerActivity(), todayCounts(),
  ]);
  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]): T[] =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);

  const loggedToday = {
    hydration: mine(hyd).some((r) => dayOf(r.loggedAt) === today),
    sleep: mine(slp).some((r) => dayOf(r.sleepStart) === today),
    mood: mine(mood).some((r) => dayOf(r.loggedAt) === today),
    activity: mine(act).some((r) => dayOf(r.loggedAt) === today),
  };
  const hydrationMl = mine(hyd)
    .filter((r) => dayOf(r.loggedAt) === today)
    .reduce((s, r) => s + (r.volumeMl || 0), 0);
  const lifetimeLogs = activity.hydrationLogs + activity.sleepLogs + activity.activityLogs +
    activity.moodLogs + activity.weightLogs + activity.foodLogs;

  return todayFocus({
    loggedToday, hydrationMl, hydrationTargetMl: targets.hydrationMl,
    currentStreak: activity.currentStreak,
    streakActiveToday: counts.logs > 0 || counts.habits > 0,
    scoreReady: lifetimeLogs >= 3,
    totalLogsToday: counts.logs,
  });
}
