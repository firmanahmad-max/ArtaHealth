"use client";
import {
  computeXp, levelForXp, bankedXp, pendingGrants, achievementId, achievementKey,
  type PlayerActivity, type TodayCounts,
} from "@arta/core";
import { db, type LocalAchievement } from "./db";
import { getActiveProfileId, flushOutbox } from "./sync";

/**
 * Gamification (Fase 6 #6) — turunkan aktivitas pemain dari Dexie (deterministik),
 * lalu engine core menghitung XP/level/badge/misi. Difilter profil aktif (owner) —
 * data anggota keluarga (source=family) TAK ikut. Derive, bukan status tersimpan
 * (persistensi player_stats/achievements = GM-2).
 */

/** Tanggal LOKAL "YYYY-MM-DD" — konsisten untuk waktu sekarang & timestamp tersimpan
 *  (loggedAt disimpan UTC ISO; slice string UTC bisa meleset 1 hari di zona +/-). */
const localDay = (d: Date): string => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayKey = (): string => localDay(new Date());
const dayOf = (iso: string): string => localDay(new Date(iso));

/** Streak hari (beruntun) dari tanggal penyelesaian kebiasaan profil aktif. */
function streaks(dates: string[]): { current: number; longest: number } {
  const days = [...new Set(dates)].sort(); // "YYYY-MM-DD" ascending
  if (days.length === 0) return { current: 0, longest: 0 };
  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]! + "T00:00:00");
    const cur = new Date(days[i]! + "T00:00:00");
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    run = diff === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  // current: run yang berakhir hari ini / kemarin
  const today = todayKey();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const last = days[days.length - 1]!;
  let current = 0;
  if (last === today || last === yesterday) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      const prev = new Date(days[i - 1]! + "T00:00:00");
      const cur = new Date(days[i]! + "T00:00:00");
      if (Math.round((cur.getTime() - prev.getTime()) / 86400000) === 1) current++;
      else break;
    }
  }
  return { current, longest };
}

/** Aktivitas kumulatif profil aktif (untuk XP/level/badge). */
export async function playerActivity(): Promise<PlayerActivity> {
  const pid = await getActiveProfileId();
  const [hyd, slp, act, mood, wt, food, bio, scans, comps] = await Promise.all([
    db.hydration_logs.toArray(), db.sleep_logs.toArray(), db.activity_logs.toArray(),
    db.mood_logs.toArray(), db.weight_logs.toArray(), db.food_logs.toArray(),
    db.biomarker_readings.toArray(), db.product_scans.toArray(), db.habit_completions.toArray(),
  ]);
  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]) =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);
  const comp = mine(comps as never);
  const { current, longest } = streaks(comp.map((c) => (c as unknown as { date: string }).date));
  return {
    habitCompletions: comp.length,
    currentStreak: current, longestStreak: longest,
    hydrationLogs: mine(hyd as never).length, sleepLogs: mine(slp as never).length,
    activityLogs: mine(act as never).length, moodLogs: mine(mood as never).length,
    weightLogs: mine(wt as never).length, foodLogs: mine(food as never).length,
    biomarkerReadings: mine(bio as never).length, productScans: mine(scans as never).length,
  };
}

/** Hitungan aktivitas HARI INI (untuk misi harian). */
export async function todayCounts(): Promise<TodayCounts> {
  const pid = await getActiveProfileId();
  const t = todayKey();
  const [hyd, slp, act, mood, wt, food, comps] = await Promise.all([
    db.hydration_logs.toArray(), db.sleep_logs.toArray(), db.activity_logs.toArray(),
    db.mood_logs.toArray(), db.weight_logs.toArray(), db.food_logs.toArray(), db.habit_completions.toArray(),
  ]);
  const mineToday = (rows: { profileId: string; deletedAt: string | null; loggedAt?: string }[]) =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt && r.loggedAt && dayOf(r.loggedAt) === t);
  // sleep_logs pakai sleepStart, bukan loggedAt
  const sleepToday = (slp as { profileId: string; deletedAt: string | null; sleepStart: string }[])
    .filter((r) => r.profileId === pid && !r.deletedAt && r.sleepStart && dayOf(r.sleepStart) === t).length;
  const hydration = mineToday(hyd as never).length;
  const logs = hydration + sleepToday + mineToday(act as never).length +
    mineToday(mood as never).length + mineToday(wt as never).length + mineToday(food as never).length;
  const habits = (comps as { profileId: string; deletedAt: string | null; date: string }[])
    .filter((c) => c.profileId === pid && !c.deletedAt && c.date === t).length;
  return { logs, hydration, habits };
}

/** Ringkas XP + level dari aktivitas (untuk header kartu). */
export async function playerLevel() {
  const a = await playerActivity();
  const xp = computeXp(a);
  return { activity: a, xp, ...levelForXp(xp) };
}

// ===== Persistensi (GM-2) =====

/** Achievement tersimpan (aktif) milik profil aktif. */
export async function persistedAchievements(): Promise<LocalAchievement[]> {
  const pid = await getActiveProfileId();
  return (await db.achievements.where("profileId").equals(pid).toArray()).filter((r) => !r.deletedAt);
}

/** Total XP = aktivitas tersinkron + bonus misi yang sudah dibank. */
export async function totalXp(): Promise<number> {
  const [a, persisted] = await Promise.all([playerActivity(), persistedAchievements()]);
  return computeXp(a) + bankedXp(persisted);
}

let granting = false;
/**
 * Catat reward yang layak diraih tapi belum tersimpan (badge & misi tuntas hari ini).
 * WAJIB dipanggil dari efek (BUKAN di dalam liveQuery) → hindari ReadOnlyError.
 * Idempoten via id deterministik. Mengembalikan key badge yang BARU diraih (untuk toast).
 */
export async function grantAchievements(): Promise<string[]> {
  if (granting) return [];
  granting = true;
  try {
    const pid = await getActiveProfileId();
    const [activity, today, existing] = await Promise.all([
      playerActivity(), todayCounts(), persistedAchievements(),
    ]);
    const have = new Set(existing.map((r) => achievementKey(r.kind, r.key, r.day)));
    const pending = pendingGrants(activity, today, todayKey(), have);
    if (pending.length === 0) return [];
    const now = new Date().toISOString();
    const rows: LocalAchievement[] = pending.map((g) => ({
      id: achievementId(pid, g.kind, g.key, g.day), profileId: pid,
      kind: g.kind, key: g.key, day: g.day, xp: g.xp,
      earnedAt: now, updatedAt: now, deletedAt: null,
    }));
    await db.transaction("rw", db.achievements, db.outbox, async () => {
      for (const row of rows) {
        await db.achievements.put(row);
        await db.outbox.add({ table: "achievements", clientId: row.id, attempts: 0, queuedAt: now });
      }
    });
    void flushOutbox();
    return pending.filter((g) => g.kind === "badge").map((g) => g.key);
  } finally {
    granting = false;
  }
}
