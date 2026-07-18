"use client";
import { db, type LogTableName, type LocalHydrationLog, type LocalSleepLog, type LocalActivityLog, type LocalMoodLog, type LocalWeightLog } from "./db";
import { getSupabase, type PrimaryProfile } from "./supabase";

/**
 * Outbox sync engine — push-only (V1): tulisan lokal diteruskan ke Supabase
 * dengan idempotensi unique(profile_id, client_id). Gagal → antre lagi, urutan dijaga.
 */

/** Dipakai saat dev tanpa Supabase / belum login — sync tidak berjalan untuk id ini. */
export const LOCAL_PROFILE_ID = "00000000-0000-4000-8000-000000000000";

export async function getActiveProfileId(): Promise<string> {
  const cached = await db.meta.get("profileId");
  return cached?.value ?? LOCAL_PROFILE_ID;
}

/** Panggil saat sesi valid — cache profil + target agar dashboard bekerja offline. */
export async function cacheProfile(p: PrimaryProfile): Promise<void> {
  await db.meta.bulkPut([
    { key: "profileId", value: p.id },
    { key: "displayName", value: p.display_name },
    { key: "targetHydrationMl", value: String(p.target_hydration_ml) },
    { key: "targetSteps", value: String(p.target_steps) },
  ]);
}

export async function getTargets(): Promise<{ hydrationMl: number; steps: number }> {
  const [h, s] = await Promise.all([db.meta.get("targetHydrationMl"), db.meta.get("targetSteps")]);
  return { hydrationMl: Number(h?.value) || 2500, steps: Number(s?.value) || 8000 };
}

type AnyLocalRow = LocalHydrationLog | LocalSleepLog | LocalActivityLog | LocalMoodLog | LocalWeightLog;

function toServerRow(table: LogTableName, row: AnyLocalRow): Record<string, unknown> {
  const base = { profile_id: row.profileId, client_id: row.clientId, deleted_at: row.deletedAt };
  switch (table) {
    case "hydration_logs": {
      const r = row as LocalHydrationLog;
      return { ...base, beverage: r.beverage, volume_ml: r.volumeMl, logged_at: r.loggedAt, source: "manual" };
    }
    case "sleep_logs": {
      const r = row as LocalSleepLog;
      return { ...base, sleep_start: r.sleepStart, sleep_end: r.sleepEnd, quality: r.quality ?? null, source: "manual" };
    }
    case "activity_logs": {
      const r = row as LocalActivityLog;
      return { ...base, activity_type: r.activityType, duration_min: r.durationMin ?? null, steps: r.steps ?? null, logged_at: r.loggedAt, source: "manual" };
    }
    case "mood_logs": {
      const r = row as LocalMoodLog;
      return { ...base, mood: r.mood, note: r.note ?? null, logged_at: r.loggedAt };
    }
    case "weight_logs": {
      const r = row as LocalWeightLog;
      return { ...base, weight_kg: r.weightKg, logged_at: r.loggedAt };
    }
  }
}

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  const supabase = getSupabase();
  if (!supabase) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    const profileId = await getActiveProfileId();
    if (profileId === LOCAL_PROFILE_ID) return;
    const entries = await db.outbox.orderBy("id").toArray();
    for (const entry of entries) {
      const row = (await db[entry.table].get(entry.clientId)) as AnyLocalRow | undefined;
      if (!row) { await db.outbox.delete(entry.id!); continue; }
      const { error } = await supabase
        .from(entry.table)
        .upsert(toServerRow(entry.table, row), { onConflict: "profile_id,client_id" });
      if (error) {
        // berhenti di entri gagal pertama agar urutan kausal terjaga; dicoba lagi nanti
        await db.outbox.update(entry.id!, { attempts: entry.attempts + 1, lastError: error.message });
        return;
      }
      await db.outbox.delete(entry.id!);
    }
  } finally {
    flushing = false;
  }
}

/** Pasang listener online + interval; kembalikan fungsi cleanup. */
export function startSyncLoop(): () => void {
  const onOnline = () => void flushOutbox();
  window.addEventListener("online", onOnline);
  const interval = setInterval(onOnline, 30_000);
  void flushOutbox();
  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(interval);
  };
}
