"use client";
import {
  dedupeSamples, rollupDaily, parseWearableImport,
  type WearableSample, type DailyRollup, type WearableType,
} from "@arta/core";
import { db, type LocalWearableSample } from "./db";
import { getActiveProfileId } from "./sync";

/**
 * Wearable / Health Connect (V3-7 · WR-1) — lapisan penyimpanan & baca yang INERT di web.
 * Engine dedup/rollup ada di @arta/core (teruji). Di sini: simpan sampel native ke Dexie
 * (idempoten via id) → outbox → sync T1, dan baca rollup harian untuk kartu/skor.
 *
 * Pengambilan native (Health Connect/HealthKit) = WR-2 (butuh Capacitor + device). Selama
 * belum ada bridge native, `isWearableNativeReady()` = false. Jembatan non-native (WR-1b):
 * IMPOR FILE (CSV/JSON) → `importWearableText` → engine yang sama → rollup tampil di web.
 */

const enqueue = (id: string): Promise<unknown> =>
  db.outbox.add({ table: "wearable_samples", clientId: id, attempts: 0, queuedAt: new Date().toISOString() });

/** id lokal stabil = dedup platform (satu sampel per sumber+externalId). */
const sampleId = (s: WearableSample): string => `${s.source}:${s.externalId}`;

/**
 * Apakah jembatan native (Capacitor + plugin Health Connect/HealthKit) tersedia?
 * Di web PWA selalu false → seluruh jalur wearable inert. Native (WR-2) akan menyediakan
 * `window.Capacitor.isNativePlatform()` + plugin; sampai itu ada, tak ada yang menulis sampel.
 */
export function isWearableNativeReady(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * Simpan sampel dari native ke Dexie (dedup dulu via engine) → enqueue ke outbox.
 * Dipanggil oleh bridge native (WR-2). Idempoten: id = `${source}:${externalId}`.
 * No-op bila tak ada sampel. Data T1 — tak pernah di-log.
 */
export async function ingestWearableSamples(samples: WearableSample[]): Promise<number> {
  const clean = dedupeSamples(samples);
  if (clean.length === 0) return 0;
  const profileId = await getActiveProfileId();
  const now = new Date().toISOString();
  const rows: LocalWearableSample[] = clean.map((s) => ({
    id: sampleId(s), profileId, type: s.type, value: s.value, unit: s.unit,
    startAt: s.startAt, endAt: s.endAt ?? null, source: s.source, externalId: s.externalId,
    updatedAt: now, deletedAt: null,
  }));
  await db.wearable_samples.bulkPut(rows);
  for (const r of rows) await enqueue(r.id);
  return rows.length;
}

/**
 * Impor sampel dari teks file (CSV/JSON) → parse deterministik → simpan (dedup) ke Dexie.
 * Jembatan WR-1b tanpa native: baris tak valid dilewati (dilaporkan di `skipped`). Data T1.
 */
export async function importWearableText(text: string): Promise<{ imported: number; skipped: number }> {
  const { samples, skipped } = parseWearableImport(text);
  const imported = await ingestWearableSamples(samples);
  return { imported, skipped };
}

/**
 * Hapus (tombstone) semua sampel wearable milik profil aktif → reversibilitas impor. Tombstone
 * (deletedAt) ikut disinkron agar terhapus lintas-perangkat. Kembalikan jumlah yang dihapus.
 */
export async function clearWearableData(): Promise<number> {
  const pid = await getActiveProfileId();
  const rows = (await db.wearable_samples.toArray()).filter((r) => r.profileId === pid && !r.deletedAt);
  if (rows.length === 0) return 0;
  const now = new Date().toISOString();
  await db.wearable_samples.bulkPut(rows.map((r) => ({ ...r, deletedAt: now, updatedAt: now })));
  for (const r of rows) await enqueue(r.id);
  return rows.length;
}

const toSample = (r: LocalWearableSample): WearableSample => ({
  externalId: r.externalId, type: r.type, value: r.value, unit: r.unit,
  startAt: r.startAt, endAt: r.endAt ?? undefined, source: r.source,
});

/** Sampel wearable profil aktif (tanpa tombstone). Kosong di web (inert). */
async function activeSamples(): Promise<WearableSample[]> {
  const pid = await getActiveProfileId();
  return (await db.wearable_samples.toArray())
    .filter((r) => r.profileId === pid && !r.deletedAt)
    .map(toSample);
}

/** Rollup harian per (hari lokal, jenis) untuk kartu & (kelak) skor. Kosong di web. */
export async function wearableDailyRollup(): Promise<DailyRollup[]> {
  return rollupDaily(await activeSamples());
}

/** Nilai rollup hari lokal ini untuk satu metrik, atau null bila tak ada. */
export async function wearableTodayValue(type: WearableType, nowMs = Date.now()): Promise<number | null> {
  const d = new Date(nowMs);
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hit = (await wearableDailyRollup()).find((r) => r.day === today && r.type === type);
  return hit ? hit.value : null;
}
