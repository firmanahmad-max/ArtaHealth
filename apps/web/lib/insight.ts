"use client";
import { aggregateDayInputs, computeHealthScore, isScheduledOn, isoWeekdayOf, type InsightContext } from "@arta/core";
import { db } from "./db";
import { getTargets } from "./sync";

/** Membangun konteks ringkas untuk AI Insight dari IndexedDB (bekerja offline). */

const dateKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayBounds = (d: Date) => {
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

async function dayInputs(day: Date, targets: { hydrationMl: number; steps: number }) {
  const { startIso, endIso } = dayBounds(day);
  const dateKey = dateKeyOf(day);
  const between = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

  const [hydration, sleep, activity, mood, habits, completions] = await Promise.all([
    db.hydration_logs.where("loggedAt").between(startIso, endIso).toArray(),
    db.sleep_logs.where("sleepEnd").between(startIso, endIso).toArray(),
    db.activity_logs.where("loggedAt").between(startIso, endIso).toArray(),
    db.mood_logs.where("loggedAt").between(startIso, endIso).toArray(),
    db.habits.filter((h) => h.isActive && !h.deletedAt).toArray(),
    db.habit_completions.where("date").equals(dateKey).toArray(),
  ]);

  const weekday = isoWeekdayOf(dateKey);
  const scheduled = habits.filter((h) => isScheduledOn(h.schedule, weekday) && h.createdAt.slice(0, 10) <= dateKey);
  const done = new Set(between(completions).map((c) => c.habitId));

  return aggregateDayInputs(
    {
      hydration: between(hydration),
      sleep: between(sleep),
      activity: between(activity),
      mood: between(mood).map((m) => ({ mood: m.mood, loggedAt: m.loggedAt })),
      habits: scheduled.length > 0
        ? { completed: scheduled.filter((h) => done.has(h.id)).length, total: scheduled.length }
        : undefined,
    },
    targets,
  );
}

export async function buildInsightContext(): Promise<{ context: InsightContext; dateKey: string }> {
  const targets = await getTargets();
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const [inputsToday, inputsYesterday] = await Promise.all([
    dayInputs(today, targets),
    dayInputs(yesterday, targets),
  ]);

  const scoreToday = computeHealthScore(inputsToday).score;
  const rawYesterday = computeHealthScore(inputsYesterday);
  const hasYesterday = Object.keys(inputsYesterday).length > 0;

  // alasan perubahan dihitung deterministik — AI menarasikan, tidak mengarang sebab
  const deltaReason: string[] = [];
  if (hasYesterday) {
    const a = computeHealthScore(inputsToday).breakdown.raw;
    const b = rawYesterday.breakdown.raw;
    for (const k of ["sleep", "hydration", "activity", "mood", "habit"] as const) {
      const now = a[k]; const before = b[k];
      if (now === undefined || before === undefined) continue;
      if (now - before >= 10) deltaReason.push(`${k}_up`);
      else if (before - now >= 10) deltaReason.push(`${k}_down`);
    }
  }

  const context: InsightContext = {
    date: dateKeyOf(today),
    score: {
      today: scoreToday,
      ...(hasYesterday ? { yesterday: rawYesterday.score } : {}),
      deltaReason,
    },
    ...(inputsToday.sleep ? { sleep: { durationMin: inputsToday.sleep.durationMin } } : {}),
    ...(inputsToday.hydration
      ? {
          hydration: {
            totalMl: inputsToday.hydration.intakeMl,
            targetMl: inputsToday.hydration.targetMl,
            pct: Math.round((inputsToday.hydration.intakeMl / inputsToday.hydration.targetMl) * 100),
          },
        }
      : {}),
    ...(inputsToday.activity
      ? {
          activity: {
            ...(inputsToday.activity.steps !== undefined ? { steps: inputsToday.activity.steps } : {}),
            target: inputsToday.activity.stepTarget,
            ...(inputsToday.activity.exerciseMin !== undefined ? { exerciseMin: inputsToday.activity.exerciseMin } : {}),
          },
        }
      : {}),
    ...(inputsToday.mood !== undefined ? { mood: inputsToday.mood } : {}),
    ...(inputsToday.habits ? { habits: inputsToday.habits } : {}),
  };

  return { context, dateKey: context.date };
}

/** Ada data yang layak dinarasikan? Hari kosong tidak perlu insight. */
export const hasEnoughData = (ctx: InsightContext): boolean =>
  !!(ctx.sleep || ctx.hydration || ctx.activity || ctx.mood !== undefined || ctx.habits);
