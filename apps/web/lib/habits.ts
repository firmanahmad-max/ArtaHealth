"use client";
import { habitSchema, isScheduledOn, isoWeekdayOf, computeStreak, type StreakDay } from "@arta/core";
import { db, type LocalHabit } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";

/** Habit engine sisi client — offline-first, pola sama dengan quicklog.ts. */

const dateKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayKey = () => dateKeyOf(new Date());

export async function createHabit(input: { name: string; icon?: string; scheduleDays: number[] }): Promise<string> {
  const parsed = habitSchema.parse(input);
  const id = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  await db.transaction("rw", db.habits, db.outbox, async () => {
    await db.habits.put({
      id, profileId, name: parsed.name, icon: parsed.icon,
      schedule: { days: [...parsed.scheduleDays].sort((a, b) => a - b) },
      isActive: true, createdAt: new Date().toISOString(), deletedAt: null,
    });
    await db.outbox.add({ table: "habits", clientId: id, attempts: 0, queuedAt: new Date().toISOString() });
  });
  void flushOutbox();
  return id;
}

/** Centang/batal centang untuk tanggal lokal; baris stabil per (habit, tanggal). */
export async function toggleCompletion(habitId: string, dateKey: string, completed: boolean): Promise<void> {
  const clientId = `${habitId}:${dateKey}`;
  const profileId = await getActiveProfileId();
  await db.transaction("rw", db.habit_completions, db.outbox, async () => {
    await db.habit_completions.put({
      clientId, profileId, habitId, date: dateKey, value: completed ? 1 : 0,
      deletedAt: completed ? null : new Date().toISOString(),
    });
    await db.outbox.add({ table: "habit_completions", clientId, attempts: 0, queuedAt: new Date().toISOString() });
  });
  void flushOutbox();
}

/** StreakDay[] untuk computeStreak — mundur `windowDays` hari dari hari ini. */
export function buildStreakDays(
  habits: LocalHabit[],
  completions: { habitId: string; date: string; deletedAt: string | null }[],
  windowDays = 60,
): StreakDay[] {
  const active = habits.filter((h) => h.isActive && !h.deletedAt);
  const doneByDate = new Map<string, Set<string>>();
  for (const c of completions) {
    if (c.deletedAt) continue;
    if (!doneByDate.has(c.date)) doneByDate.set(c.date, new Set());
    doneByDate.get(c.date)!.add(c.habitId);
  }
  const days: StreakDay[] = [];
  const cursor = new Date();
  for (let i = 0; i < windowDays; i++) {
    const dateKey = dateKeyOf(cursor);
    const weekday = isoWeekdayOf(dateKey);
    // habit belum ada pada tanggal itu → tidak dianggap terjadwal (adil untuk habit baru)
    const scheduled = active.filter(
      (h) => isScheduledOn(h.schedule, weekday) && h.createdAt.slice(0, 10) <= dateKey,
    );
    const done = doneByDate.get(dateKey) ?? new Set();
    days.push({
      dateKey,
      scheduledCount: scheduled.length,
      completedCount: scheduled.filter((h) => done.has(h.id)).length,
    });
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

export function currentStreak(
  habits: LocalHabit[],
  completions: { habitId: string; date: string; deletedAt: string | null }[],
): number {
  return computeStreak(buildStreakDays(habits, completions));
}
