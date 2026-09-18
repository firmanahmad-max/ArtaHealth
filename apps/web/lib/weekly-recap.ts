"use client";
import { weeklyRecap, weekStartLocal, type WeeklyRecap } from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";
import { playerActivity } from "./gamification";

/**
 * Ringkasan Mingguan (Fase 8 · KR-5) — rakit metrik konsistensi minggu ini vs minggu lalu (hari
 * aktif, jumlah catatan) + streak dari Dexie profil aktif, lalu jalankan engine deterministik
 * @arta/core. Minggu = Senin-lokal (konsisten dgn Papan poin). Non-medis.
 */

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localDay = (ms: number): string => ymd(new Date(ms));

export async function weeklyRecapData(nowMs = Date.now()): Promise<WeeklyRecap> {
  const pid = await getActiveProfileId();
  const [hyd, slp, mood, act, weight, food, habits, activity] = await Promise.all([
    db.hydration_logs.toArray(), db.sleep_logs.toArray(), db.mood_logs.toArray(),
    db.activity_logs.toArray(), db.weight_logs.toArray(), db.food_logs.toArray(),
    db.habit_completions.toArray(), playerActivity(),
  ]);
  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]): T[] =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);

  const thisMonday = weekStartLocal(new Date(nowMs));
  const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
  const thisKey = ymd(thisMonday), lastKey = ymd(lastMonday);

  // Kumpulkan hari-lokal tiap catatan (log gaya hidup + habit).
  const days: string[] = [];
  const pushIso = (iso?: string | null) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) days.push(localDay(t));
  };
  for (const r of mine(hyd)) pushIso(r.loggedAt);
  for (const r of mine(slp)) pushIso(r.sleepStart);
  for (const r of mine(mood)) pushIso(r.loggedAt);
  for (const r of mine(act)) pushIso(r.loggedAt);
  for (const r of mine(weight)) pushIso(r.loggedAt);
  for (const r of mine(food)) pushIso(r.loggedAt);
  for (const r of mine(habits)) if (r.date) days.push(r.date); // sudah "YYYY-MM-DD" lokal

  const weekKeyOfDay = (day: string): string => ymd(weekStartLocal(new Date(`${day}T00:00:00`)));
  const thisDays = new Set<string>(), lastDays = new Set<string>();
  let thisLogs = 0;
  for (const day of days) {
    const wk = weekKeyOfDay(day);
    if (wk === thisKey) { thisDays.add(day); thisLogs++; }
    else if (wk === lastKey) lastDays.add(day);
  }

  return weeklyRecap({
    activeDays: thisDays.size, totalLogs: thisLogs,
    prevActiveDays: lastDays.size, currentStreak: activity.currentStreak,
  });
}
