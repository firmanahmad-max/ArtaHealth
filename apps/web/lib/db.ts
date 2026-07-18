"use client";
import Dexie, { type EntityTable } from "dexie";

/**
 * IndexedDB lokal — sumber kebenaran pertama untuk SEMUA logging (CONTEXT §3).
 * Tanggal disimpan sebagai ISO string. Soft delete via deletedAt (tombstone ikut disinkron).
 * Nama tabel disamakan dengan Postgres agar mapping sync 1:1.
 */

export interface LocalHydrationLog {
  clientId: string; profileId: string;
  beverage: "water" | "coffee" | "tea" | "milk" | "juice";
  volumeMl: number;
  loggedAt: string; deletedAt: string | null;
}
export interface LocalSleepLog {
  clientId: string; profileId: string;
  sleepStart: string; sleepEnd: string; quality?: number;
  deletedAt: string | null;
}
export interface LocalActivityLog {
  clientId: string; profileId: string;
  activityType: "walk" | "run" | "cycle" | "gym" | "stretch" | "yoga" | "other";
  durationMin?: number; steps?: number;
  loggedAt: string; deletedAt: string | null;
}
export interface LocalMoodLog {
  clientId: string; profileId: string;
  mood: number; note?: string;
  loggedAt: string; deletedAt: string | null;
}
export interface LocalWeightLog {
  clientId: string; profileId: string;
  weightKg: number;
  loggedAt: string; deletedAt: string | null;
}

export type LogTableName = "hydration_logs" | "sleep_logs" | "activity_logs" | "mood_logs" | "weight_logs";

export interface OutboxEntry {
  id?: number;
  table: LogTableName;
  clientId: string;
  attempts: number;
  queuedAt: string;
  lastError?: string;
}
export interface MetaEntry { key: string; value: string }

type ArtaDB = Dexie & {
  hydration_logs: EntityTable<LocalHydrationLog, "clientId">;
  sleep_logs: EntityTable<LocalSleepLog, "clientId">;
  activity_logs: EntityTable<LocalActivityLog, "clientId">;
  mood_logs: EntityTable<LocalMoodLog, "clientId">;
  weight_logs: EntityTable<LocalWeightLog, "clientId">;
  outbox: EntityTable<OutboxEntry, "id">;
  meta: EntityTable<MetaEntry, "key">;
};

export const db = new Dexie("artahealth") as ArtaDB;

db.version(1).stores({
  hydration_logs: "clientId, loggedAt",
  sleep_logs: "clientId, sleepEnd",
  activity_logs: "clientId, loggedAt",
  mood_logs: "clientId, loggedAt",
  weight_logs: "clientId, loggedAt",
  outbox: "++id, table",
  meta: "key",
});

/** Awal hari lokal perangkat (ISO) — batas "hari ini" untuk skor & dashboard. */
export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
