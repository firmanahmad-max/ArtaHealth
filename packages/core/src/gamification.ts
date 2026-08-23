/**
 * Gamification (Fase 6 #6) — engine XP/level/badge/misi DETERMINISTIK. Menghitung
 * reward dari AKTIVITAS yang sudah dicatat (habit, log, biomarker, gizi) — bukan
 * status tersimpan. Bisa dijelaskan & konsisten (tak bisa "curang"). Persistensi
 * (player_stats/achievements, blueprint §3) menyusul di GM-2.
 *
 * Prinsip: hadiah untuk perilaku sehat, TAK menghukum. Tanpa data ≠ minus.
 */

/** Ringkasan aktivitas kumulatif (diturunkan dari Dexie di klien). */
export interface PlayerActivity {
  habitCompletions: number;
  currentStreak: number;
  longestStreak: number;
  hydrationLogs: number;
  sleepLogs: number;
  activityLogs: number;
  moodLogs: number;
  weightLogs: number;
  biomarkerReadings: number;
  foodLogs: number;
  productScans: number;
}

const zero: PlayerActivity = {
  habitCompletions: 0, currentStreak: 0, longestStreak: 0, hydrationLogs: 0, sleepLogs: 0,
  activityLogs: 0, moodLogs: 0, weightLogs: 0, biomarkerReadings: 0, foodLogs: 0, productScans: 0,
};

/** Poin XP per jenis aktivitas. */
export const XP_RULES = {
  habitCompletion: 10,
  log: 5,          // hidrasi/tidur/aktivitas/mood/berat/gizi
  biomarker: 15,
  scan: 8,
  streakDay: 2,    // bonus per hari streak berjalan
} as const;

const totalLogs = (a: PlayerActivity): number =>
  a.hydrationLogs + a.sleepLogs + a.activityLogs + a.moodLogs + a.weightLogs + a.foodLogs;

/** Total XP dari aktivitas (deterministik). */
export function computeXp(a: PlayerActivity): number {
  return (
    a.habitCompletions * XP_RULES.habitCompletion +
    totalLogs(a) * XP_RULES.log +
    a.biomarkerReadings * XP_RULES.biomarker +
    a.productScans * XP_RULES.scan +
    a.currentStreak * XP_RULES.streakDay
  );
}

/** XP kumulatif minimum untuk mencapai suatu level (kurva menanjak: 100,200,300,...). */
export function xpForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return (100 * (L - 1) * L) / 2; // L1=0, L2=100, L3=300, L4=600, L5=1000
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;   // XP di dalam level saat ini
  xpForNext: number;     // XP dibutuhkan level ini→berikutnya
  progress: number;      // 0..1 menuju level berikutnya
}

export function levelForXp(xp: number): LevelInfo {
  const x = Math.max(0, xp);
  let level = 1;
  while (xpForLevel(level + 1) <= x) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const xpForNext = next - base;
  const xpIntoLevel = x - base;
  return { level, xpIntoLevel, xpForNext, progress: xpForNext > 0 ? xpIntoLevel / xpForNext : 0 };
}

// ===== Badge =====

export interface Badge {
  key: string;
  label: string;
  icon: string;
  desc: string;
  earned: (a: PlayerActivity) => boolean;
}

export const BADGES: Badge[] = [
  { key: "first_log", label: "Langkah Pertama", icon: "🌱", desc: "Catatan pertamamu", earned: (a) => totalLogs(a) + a.habitCompletions + a.biomarkerReadings >= 1 },
  { key: "streak_7", label: "Seminggu Konsisten", icon: "🔥", desc: "Streak 7 hari", earned: (a) => a.longestStreak >= 7 },
  { key: "streak_30", label: "Sebulan Disiplin", icon: "🏆", desc: "Streak 30 hari", earned: (a) => a.longestStreak >= 30 },
  { key: "hydration_50", label: "Rajin Minum", icon: "💧", desc: "50 catatan hidrasi", earned: (a) => a.hydrationLogs >= 50 },
  { key: "biomarker_first", label: "Sadar Kondisi", icon: "🩺", desc: "Catat biomarker pertama", earned: (a) => a.biomarkerReadings >= 1 },
  { key: "nutrition_10", label: "Sadar Gizi", icon: "🍽️", desc: "10 catatan makan", earned: (a) => a.foodLogs >= 10 },
  { key: "habit_50", label: "Pembangun Kebiasaan", icon: "🧱", desc: "50 kebiasaan tuntas", earned: (a) => a.habitCompletions >= 50 },
  { key: "level_5", label: "Naik Kelas", icon: "⭐", desc: "Capai level 5", earned: (a) => levelForXp(computeXp(a)).level >= 5 },
  { key: "level_10", label: "Juara Sehat", icon: "👑", desc: "Capai level 10", earned: (a) => levelForXp(computeXp(a)).level >= 10 },
];

export function earnedBadges(a: PlayerActivity): Badge[] {
  return BADGES.filter((b) => b.earned(a));
}

// ===== Misi harian =====

/** Hitungan aktivitas HARI INI (diturunkan di klien). */
export interface TodayCounts {
  logs: number;      // total log hari ini (semua jenis)
  hydration: number;
  habits: number;    // kebiasaan tuntas hari ini
}

export interface DailyMission {
  key: string;
  label: string;
  icon: string;
  target: number;
  xp: number;
  metric: keyof TodayCounts;
}

export const DAILY_MISSIONS: DailyMission[] = [
  { key: "log3", label: "Catat 3 aktivitas", icon: "✅", target: 3, xp: 20, metric: "logs" },
  { key: "hydrate4", label: "Catat minum 4×", icon: "💧", target: 4, xp: 15, metric: "hydration" },
  { key: "habit1", label: "Selesaikan 1 kebiasaan", icon: "🎯", target: 1, xp: 15, metric: "habits" },
];

export interface MissionStatus {
  mission: DailyMission;
  current: number;
  done: boolean;
}

export function missionStatus(today: TodayCounts): MissionStatus[] {
  return DAILY_MISSIONS.map((m) => {
    const current = Math.min(today[m.metric], m.target);
    return { mission: m, current, done: today[m.metric] >= m.target };
  });
}

/** Bonus XP misi harian yang tuntas (belum termasuk di computeXp — reward sesaat). */
export function missionBonusXp(today: TodayCounts): number {
  return missionStatus(today).filter((s) => s.done).reduce((sum, s) => sum + s.mission.xp, 0);
}

export const emptyActivity = (): PlayerActivity => ({ ...zero });
