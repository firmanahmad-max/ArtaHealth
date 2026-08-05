"use client";
import { db, type LogTableName, type LocalHydrationLog, type LocalSleepLog, type LocalActivityLog, type LocalMoodLog, type LocalWeightLog } from "./db";
import { getSupabase, type PrimaryProfile } from "./supabase";

/**
 * Sync engine dua arah:
 * - Push: outbox lokal diteruskan ke Supabase dengan idempotensi
 *   unique(profile_id, client_id). Gagal → antre lagi, urutan dijaga.
 * - Pull: inkremental per tabel dengan kursor `updated_at` (migration 0006);
 *   baris yang masih antre di outbox TIDAK ditimpa (niat lokal menang sampai ter-push).
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

// ===== Pull =====

type ServerRow = Record<string, unknown> & { client_id: string; updated_at: string };

function fromServerRow(table: LogTableName, r: ServerRow): AnyLocalRow {
  const base = {
    clientId: r.client_id as string,
    profileId: r.profile_id as string,
    deletedAt: (r.deleted_at as string | null) ?? null,
  };
  switch (table) {
    case "hydration_logs":
      return { ...base, beverage: r.beverage, volumeMl: r.volume_ml, loggedAt: r.logged_at } as LocalHydrationLog;
    case "sleep_logs":
      return { ...base, sleepStart: r.sleep_start, sleepEnd: r.sleep_end, quality: r.quality ?? undefined } as LocalSleepLog;
    case "activity_logs":
      return {
        ...base, activityType: r.activity_type,
        durationMin: r.duration_min ?? undefined, steps: r.steps ?? undefined, loggedAt: r.logged_at,
      } as LocalActivityLog;
    case "mood_logs":
      return { ...base, mood: r.mood, note: r.note ?? undefined, loggedAt: r.logged_at } as LocalMoodLog;
    case "weight_logs":
      return { ...base, weightKg: r.weight_kg, loggedAt: r.logged_at } as LocalWeightLog;
  }
}

const LOG_TABLES: LogTableName[] = ["hydration_logs", "sleep_logs", "activity_logs", "mood_logs", "weight_logs"];
const PULL_PAGE = 500;
let pulling = false;

export async function pullAll(): Promise<void> {
  if (pulling) return;
  const supabase = getSupabase();
  if (!supabase) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  pulling = true;
  try {
    const profileId = await getActiveProfileId();
    if (profileId === LOCAL_PROFILE_ID) return;
    for (const table of LOG_TABLES) {
      try {
        await pullTable(table, profileId);
      } catch {
        // tabel gagal → coba lagi di siklus berikutnya; tabel lain tetap ditarik
      }
    }
  } finally {
    pulling = false;
  }
}

async function pullTable(table: LogTableName, profileId: string): Promise<void> {
  const supabase = getSupabase()!;
  const cursorKey = `pullCursor:${table}`;
  let cursor = (await db.meta.get(cursorKey))?.value ?? "1970-01-01T00:00:00Z";
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("profile_id", profileId)
      .gt("updated_at", cursor)
      .order("updated_at", { ascending: true })
      .limit(PULL_PAGE);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ServerRow[];
    if (rows.length === 0) return;

    const pendingIds = new Set(
      (await db.outbox.where("table").equals(table).toArray()).map((e) => e.clientId),
    );
    const localRows = rows.filter((r) => !pendingIds.has(r.client_id)).map((r) => fromServerRow(table, r));
    // union EntityTable tidak punya signature bulkPut gabungan → cast struktural
    const target = db[table] as unknown as { bulkPut(items: AnyLocalRow[]): Promise<unknown> };
    await db.transaction("rw", db[table], db.meta, async () => {
      await target.bulkPut(localRows);
      await db.meta.put({ key: cursorKey, value: rows[rows.length - 1]!.updated_at });
    });
    if (rows.length < PULL_PAGE) return;
  }
}

/** Pasang listener online + interval; kembalikan fungsi cleanup. */
export function startSyncLoop(): () => void {
  const tick = () => {
    void flushOutbox().then(() => pullAll());
  };
  window.addEventListener("online", tick);
  const interval = setInterval(tick, 30_000);
  tick();
  return () => {
    window.removeEventListener("online", tick);
    clearInterval(interval);
  };
}
