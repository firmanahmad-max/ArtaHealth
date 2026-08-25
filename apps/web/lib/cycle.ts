"use client";
import { predictCycle, cycleStats, type PeriodLog, type CyclePrediction, type CycleStats } from "@arta/core";
import { db, type LocalCycleLog } from "./db";
import { getActiveProfileId } from "./sync";

/**
 * Kesehatan Siklus (V3-5) — CRUD catatan mulai haid (profil aktif) + prediksi via engine
 * core. Offline-first (outbox → sync). Sensitif: hanya milik akun (RLS). Non-medis,
 * bukan alat kontrasepsi.
 */

const enqueue = (id: string): Promise<unknown> =>
  db.outbox.add({ table: "cycle_logs", clientId: id, attempts: 0, queuedAt: new Date().toISOString() });

const uuid = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `cyc-${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Catat tanggal mulai haid (YYYY-MM-DD). */
export async function addPeriod(startDate: string, lengthDays?: number | null): Promise<void> {
  const profileId = await getActiveProfileId();
  const id = uuid();
  await db.cycle_logs.put({
    id, profileId, startDate, lengthDays: lengthDays ?? null, note: null,
    updatedAt: new Date().toISOString(), deletedAt: null,
  });
  await enqueue(id);
}

/** Hapus (tombstone) catatan haid. */
export async function removePeriod(id: string): Promise<void> {
  const row = await db.cycle_logs.get(id);
  if (!row) return;
  await db.cycle_logs.put({ ...row, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await enqueue(id);
}

/** Daftar catatan haid profil aktif (terbaru dulu). */
export async function periodLogs(): Promise<LocalCycleLog[]> {
  const pid = await getActiveProfileId();
  return (await db.cycle_logs.toArray())
    .filter((r) => r.profileId === pid && !r.deletedAt)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

const toPeriodLog = (r: LocalCycleLog): PeriodLog => ({
  startISO: `${r.startDate}T00:00:00.000Z`, lengthDays: r.lengthDays ?? undefined,
});

/** Prediksi siklus dari catatan profil aktif. null bila belum ada. */
export async function cyclePrediction(nowMs = Date.now()): Promise<CyclePrediction | null> {
  return predictCycle((await periodLogs()).map(toPeriodLog), nowMs);
}

export async function cycleStatsForProfile(): Promise<CycleStats | null> {
  const logs = await periodLogs();
  return logs.length ? cycleStats(logs.map(toPeriodLog)) : null;
}
