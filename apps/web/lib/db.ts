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

export interface LocalHabit {
  /** uuid dibuat client — sekaligus kunci idempoten sync (upsert onConflict id) */
  id: string;
  profileId: string;
  name: string;
  icon?: string;
  /** ISO weekday 1=Sen..7=Min */
  schedule: { days: number[] };
  isActive: boolean;
  createdAt: string;
  deletedAt: string | null;
}
export interface LocalHabitCompletion {
  /** stabil per (habit, tanggal): `${habitId}:${date}` — toggle memakai baris yang sama */
  clientId: string;
  profileId: string;
  habitId: string;
  /** "YYYY-MM-DD" tanggal lokal */
  date: string;
  value: number;
  deletedAt: string | null;
}

/** Pembacaan biomarker (Fase 2). classification = hasil engine deterministik di-cache. */
export interface LocalBiomarkerReading {
  clientId: string; profileId: string;
  biomarker: "bp" | "glucose" | "lipid" | "uric_acid";
  /** konteks: glukosa gdp/gds/pp2/hba1c · asam urat male/female · null utk bp/lipid */
  context: string | null;
  /** {systolic,diastolic} · {value} · {totalChol,ldl,hdl,tg} sesuai biomarker */
  values: Record<string, number>;
  /** BiomarkerClassification dari @arta/core (di-cache utk tampil cepat/offline) */
  classification: unknown | null;
  measuredAt: string; note?: string;
  deletedAt: string | null;
}

/** Kondisi yang dipantau pengguna (Fase 2). Idempoten via PK id (pola habits). */
export interface LocalMonitoredCondition {
  id: string;
  profileId: string;
  condition: "hypertension" | "diabetes" | "dyslipidemia" | "hyperuricemia";
  status: "monitoring" | "controlled" | "resolved";
  since: string | null;
  note?: string;
  createdAt: string;
  deletedAt: string | null;
}

export type LogTableName = "hydration_logs" | "sleep_logs" | "activity_logs" | "mood_logs" | "weight_logs";
export type SyncTableName = LogTableName | "habits" | "habit_completions" | "biomarker_readings" | "monitored_conditions";

export interface OutboxEntry {
  id?: number;
  table: SyncTableName;
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
  habits: EntityTable<LocalHabit, "id">;
  habit_completions: EntityTable<LocalHabitCompletion, "clientId">;
  biomarker_readings: EntityTable<LocalBiomarkerReading, "clientId">;
  monitored_conditions: EntityTable<LocalMonitoredCondition, "id">;
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
// v2 (Sprint 5-6): habit engine — tabel lama tidak berubah, Dexie migrasi otomatis
db.version(2).stores({
  habits: "id, isActive",
  habit_completions: "clientId, date, habitId",
});
// v3 (Fase 2): biomarker — index [biomarker+measuredAt] melayani query trend per jenis
db.version(3).stores({
  biomarker_readings: "clientId, measuredAt, biomarker, [biomarker+measuredAt]",
});
// v4 (Fase 2): kondisi dipantau — idempoten via id (pola habits)
db.version(4).stores({
  monitored_conditions: "id, condition",
});

/** Awal hari lokal perangkat (ISO) — batas "hari ini" untuk skor & dashboard. */
export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
