/**
 * Push Ringkasan Mingguan (Fase 8 · tindak lanjut KR-5 retensi). Engine MURNI (Deno-kompatibel,
 * dipakai Edge Function `send-reminders`): dari daftar tanggal-lokal catatan → metrik minggu ini vs
 * minggu lalu (Senin-awal, sama dgn kartu "Minggu Ini") → isi notifikasi deterministik.
 *
 * ANTI-SPAM:
 *  - hanya hari Minggu, jam 19:00–20:59 lokal (sebelum jam tenang 22:00), sekali per minggu
 *    (dedup `reminder_log` kind 'weekly' oleh pemanggil);
 *  - pengguna yang 2 minggu berturut-turut tanpa catatan TIDAK dikirimi (tidak mengomeli pengguna
 *    yang sudah pergi — mereka bisa kembali sendiri);
 *  - minggu lalu aktif tapi minggu ini kosong → satu ajakan lembut untuk mulai lagi.
 * NON-MEDIS: ajakan mencatat, bukan saran kesehatan.
 */

import { weeklyRecap, type WeeklyRecap } from "./weekly-recap.ts";
import { isoWeekdayOf } from "./habits.ts";

export const WEEKLY_PUSH_WEEKDAY = 7;     // ISO: Minggu
export const WEEKLY_PUSH_FROM_HOUR = 19;
export const WEEKLY_PUSH_UNTIL_HOUR = 21;  // eksklusif

const addDays = (key: string, n: number): string => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const mondayOf = (key: string): string => addDays(key, -(isoWeekdayOf(key) - 1));

/** Rentetan hari berturut-turut yang berakhir hari ini atau kemarin (aturan sama dgn aplikasi). */
export function dayStreak(dayKeys: string[], todayKey: string): number {
  const set = new Set(dayKeys);
  let cur = set.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (set.has(cur)) { n++; cur = addDays(cur, -1); }
  return n;
}

export interface WeeklyMetrics { recap: WeeklyRecap; prevActiveDays: number }

/**
 * @param logDays   tanggal-lokal ("YYYY-MM-DD") tiap catatan (boleh berulang; satu entri = satu catatan)
 * @param streakDays tanggal-lokal penyelesaian kebiasaan (dasar rentetan, sama dgn aplikasi)
 */
export function weeklyMetrics(logDays: string[], streakDays: string[], todayKey: string): WeeklyMetrics {
  const thisMon = mondayOf(todayKey);
  const lastMon = addDays(thisMon, -7);
  const thisDays = new Set<string>(), lastDays = new Set<string>();
  let thisLogs = 0;
  for (const k of logDays) {
    if (k >= thisMon && k <= todayKey) { thisDays.add(k); thisLogs++; }
    else if (k >= lastMon && k < thisMon) lastDays.add(k);
  }
  const recap = weeklyRecap({
    activeDays: thisDays.size, totalLogs: thisLogs,
    prevActiveDays: lastDays.size, currentStreak: dayStreak(streakDays, todayKey),
  });
  return { recap, prevActiveDays: lastDays.size };
}

export interface WeeklyPush { kind: "weekly"; title: string; body: string; url: string }

/** Isi push mingguan, atau null bila bukan waktunya / tak layak dikirim (anti-spam). */
export function buildWeeklyPush(m: WeeklyMetrics, opts: { todayKey: string; hour: number }): WeeklyPush | null {
  if (isoWeekdayOf(opts.todayKey) !== WEEKLY_PUSH_WEEKDAY) return null;
  if (opts.hour < WEEKLY_PUSH_FROM_HOUR || opts.hour >= WEEKLY_PUSH_UNTIL_HOUR) return null;
  const { recap, prevActiveDays } = m;
  if (recap.activeDays === 0 && prevActiveDays === 0) return null; // 2 minggu sepi → jangan diomeli

  if (recap.activeDays === 0) {
    return {
      kind: "weekly", url: "/",
      title: "📅 Minggu ini masih kosong",
      body: `Minggu lalu kamu aktif ${prevActiveDays} hari. Mulai lagi besok — cukup satu catatan.`,
    };
  }
  const streak = recap.streak >= 2 ? ` · rentetan ${recap.streak} hari` : "";
  return {
    kind: "weekly", url: "/",
    title: "📅 Ringkasan minggu ini",
    body: `${recap.activeDays}/7 hari aktif · ${recap.totalLogs} catatan${streak}. ${recap.headline}`,
  };
}
