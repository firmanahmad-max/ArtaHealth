"use client";
import {
  hydrationLogSchema, sleepLogSchema, activityLogSchema, moodLogSchema, weightLogSchema,
} from "@arta/core";
import { db, type LogTableName } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";

/**
 * API quick-log offline-first: tulis IndexedDB dulu (selalu berhasil, <2 detik),
 * antre outbox, lalu coba flush di background. Undo = tombstone (deletedAt),
 * bukan dialog konfirmasi (CONTEXT §4).
 */

/** HANYA dipanggil di dalam transaksi rw yang mencakup db.outbox; flush dilakukan setelah commit. */
async function enqueue(table: LogTableName, clientId: string): Promise<void> {
  await db.outbox.add({ table, clientId, attempts: 0, queuedAt: new Date().toISOString() });
}

export interface LogResult { clientId: string }

export async function logHydration(volumeMl: number, beverage: "water" | "coffee" | "tea" | "milk" | "juice" = "water"): Promise<LogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const input = hydrationLogSchema.parse({ profileId, clientId, loggedAt: new Date(), beverage, volumeMl });
  await db.transaction("rw", db.hydration_logs, db.outbox, async () => {
    await db.hydration_logs.put({
      clientId, profileId, beverage: input.beverage, volumeMl: input.volumeMl,
      loggedAt: input.loggedAt.toISOString(), deletedAt: null,
    });
    await enqueue("hydration_logs", clientId);
  });
  void flushOutbox();
  return { clientId };
}

export async function logSleep(sleepStart: Date, sleepEnd: Date, quality?: number): Promise<LogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const input = sleepLogSchema.parse({ profileId, clientId, sleepStart, sleepEnd, quality });
  await db.transaction("rw", db.sleep_logs, db.outbox, async () => {
    await db.sleep_logs.put({
      clientId, profileId, sleepStart: input.sleepStart.toISOString(), sleepEnd: input.sleepEnd.toISOString(),
      quality: input.quality, deletedAt: null,
    });
    await enqueue("sleep_logs", clientId);
  });
  void flushOutbox();
  return { clientId };
}

export async function logActivity(
  activityType: "walk" | "run" | "cycle" | "gym" | "stretch" | "yoga" | "other",
  durationMin?: number,
  steps?: number,
): Promise<LogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const input = activityLogSchema.parse({ profileId, clientId, loggedAt: new Date(), activityType, durationMin, steps });
  await db.transaction("rw", db.activity_logs, db.outbox, async () => {
    await db.activity_logs.put({
      clientId, profileId, activityType: input.activityType, durationMin: input.durationMin,
      steps: input.steps, loggedAt: input.loggedAt.toISOString(), deletedAt: null,
    });
    await enqueue("activity_logs", clientId);
  });
  void flushOutbox();
  return { clientId };
}

export async function logMood(mood: number, note?: string): Promise<LogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const input = moodLogSchema.parse({ profileId, clientId, loggedAt: new Date(), mood, note });
  await db.transaction("rw", db.mood_logs, db.outbox, async () => {
    await db.mood_logs.put({
      clientId, profileId, mood: input.mood, note: input.note,
      loggedAt: input.loggedAt.toISOString(), deletedAt: null,
    });
    await enqueue("mood_logs", clientId);
  });
  void flushOutbox();
  return { clientId };
}

export async function logWeight(weightKg: number): Promise<LogResult> {
  const clientId = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const input = weightLogSchema.parse({ profileId, clientId, loggedAt: new Date(), weightKg });
  await db.transaction("rw", db.weight_logs, db.outbox, async () => {
    await db.weight_logs.put({
      clientId, profileId, weightKg: input.weightKg,
      loggedAt: input.loggedAt.toISOString(), deletedAt: null,
    });
    await enqueue("weight_logs", clientId);
  });
  void flushOutbox();
  return { clientId };
}

/** Undo toast 5 detik — tombstone lokal + antre sinkron tombstone-nya. */
export async function undoLog(table: LogTableName, clientId: string): Promise<void> {
  await db.transaction("rw", db[table], db.outbox, async () => {
    await db[table].update(clientId, { deletedAt: new Date().toISOString() });
    await enqueue(table, clientId);
  });
  void flushOutbox();
}
