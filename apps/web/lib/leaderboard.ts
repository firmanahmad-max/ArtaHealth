"use client";
import {
  weeklyPoints, weekMomentum, personalBestWeek, XP_RULES,
  type PointEvent, type WeekPoints, type WeekMomentum,
} from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";

/**
 * Leaderboard (backlog · LB-1) — papan PRIBADI-temporal: poin mingguanmu vs minggu-minggu lalumu,
 * 100% LOKAL (Dexie, tak ada data keluar perangkat). Poin diturunkan dari aktivitas tercatat via
 * XP_RULES (@arta/core), non-nilai-kesehatan. Papan SOSIAL (bandingkan dgn orang lain) = LB-3 di
 * balik gerbang privasi + backend → tak ada di sini. Lihat docs/addendum-leaderboard.md.
 */

const WEEKS = 8;

/** Kumpulkan event poin (per aktivitas) milik profil aktif dari Dexie. */
async function pointEvents(): Promise<PointEvent[]> {
  const pid = await getActiveProfileId();
  const [hydr, sleep, act, mood, weight, food, bio, scans, habits] = await Promise.all([
    db.hydration_logs.toArray(), db.sleep_logs.toArray(), db.activity_logs.toArray(),
    db.mood_logs.toArray(), db.weight_logs.toArray(), db.food_logs.toArray(),
    db.biomarker_readings.toArray(), db.product_scans.toArray(), db.habit_completions.toArray(),
  ]);
  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]): T[] =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);
  const ev: PointEvent[] = [];
  const push = (at: string | undefined, points: number) => { if (at) ev.push({ at, points }); };

  for (const r of mine(hydr)) push(r.loggedAt, XP_RULES.log);
  for (const r of mine(sleep)) push(r.sleepStart, XP_RULES.log);
  for (const r of mine(act)) push(r.loggedAt, XP_RULES.log);
  for (const r of mine(mood)) push(r.loggedAt, XP_RULES.log);
  for (const r of mine(weight)) push(r.loggedAt, XP_RULES.log);
  for (const r of mine(food)) push(r.loggedAt, XP_RULES.log);
  for (const r of mine(bio)) push(r.measuredAt, XP_RULES.biomarker);
  for (const r of mine(scans)) push(r.scannedAt, XP_RULES.scan);
  // habit_completions ber-tanggal lokal "YYYY-MM-DD" → jangkar tengah hari agar jatuh di minggu benar
  for (const r of mine(habits)) push(r.date ? `${r.date}T12:00:00` : undefined, XP_RULES.habitCompletion);
  return ev;
}

export interface PersonalLeaderboard {
  weeks: WeekPoints[];
  momentum: WeekMomentum;
  best: WeekPoints | null;
  hasData: boolean;
}

/** Papan pribadi: poin per minggu (WEEKS terakhir) + momentum + rekor. */
export async function personalLeaderboard(nowMs = Date.now()): Promise<PersonalLeaderboard> {
  const weeks = weeklyPoints(await pointEvents(), nowMs, WEEKS);
  return {
    weeks,
    momentum: weekMomentum(weeks),
    best: personalBestWeek(weeks),
    hasData: weeks.some((w) => w.events > 0),
  };
}
