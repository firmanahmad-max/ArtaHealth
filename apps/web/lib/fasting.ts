"use client";
import { computePrayerTimes, type PrayerTimes } from "@arta/core";
import { db, type LocalFastingSettings, type LocalFastingDay } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";
import { todayKey } from "./habits";

/**
 * API mode puasa offline-first (Fase 3). fasting_days = sumber kebenaran tunggal
 * status puasa (addendum-ramadan §4). Waktu imsakiyah dihitung client-side dari
 * koordinat tersimpan + offset zona waktu PERANGKAT (health app dipakai lokal).
 *
 * ⚠️ Koordinat belum di-set → pakai default Jakarta agar countdown tetap render;
 *    penangkapan lokasi akurat ada di onboarding mode (RM-3b). Akurasi vs Kemenag
 *    adalah gerbang §10 sebelum flag dinyalakan.
 */

const DEFAULT_COORDS = { latitude: -6.2088, longitude: 106.8456 }; // Jakarta

const DEFAULT_SETTINGS = (profileId: string): LocalFastingSettings => ({
  profileId,
  ramadanEnabled: false,
  ramadanStart: null,
  ramadanEnd: null,
  sunnahSchedules: [],
  sahurReminderMin: 60,
  timeCorrection: {},
  latitude: null,
  longitude: null,
  medicalAckAt: null,
});

export async function getFastingSettings(): Promise<LocalFastingSettings> {
  const profileId = await getActiveProfileId();
  return (await db.fasting_settings.get(profileId)) ?? DEFAULT_SETTINGS(profileId);
}

async function enqueueSettings(profileId: string): Promise<void> {
  await db.outbox.add({ table: "fasting_settings", clientId: profileId, attempts: 0, queuedAt: new Date().toISOString() });
}
async function enqueueDay(id: string): Promise<void> {
  await db.outbox.add({ table: "fasting_days", clientId: id, attempts: 0, queuedAt: new Date().toISOString() });
}

export async function saveFastingSettings(patch: Partial<Omit<LocalFastingSettings, "profileId">>): Promise<void> {
  const current = await getFastingSettings();
  const next: LocalFastingSettings = { ...current, ...patch };
  await db.transaction("rw", db.fasting_settings, db.outbox, async () => {
    await db.fasting_settings.put(next);
    await enqueueSettings(next.profileId);
  });
  void flushOutbox();
}

/** Offset zona waktu perangkat dalam jam (WIB +7 dst). Indonesia tanpa DST. */
const deviceTzOffsetHours = (): number => -new Date().getTimezoneOffset() / 60;

/** Waktu salat + imsak untuk sebuah tanggal lokal (default hari ini). */
export async function prayerTimesFor(date = new Date()): Promise<PrayerTimes> {
  const s = await getFastingSettings();
  return computePrayerTimes({
    year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
    coords: {
      latitude: s.latitude ?? DEFAULT_COORDS.latitude,
      longitude: s.longitude ?? DEFAULT_COORDS.longitude,
    },
    timezoneOffset: deviceTzOffsetHours(),
    params: { corrections: s.timeCorrection },
  });
}

export const hasLocation = (s: LocalFastingSettings): boolean =>
  s.latitude !== null && s.longitude !== null;

/** Status puasa suatu tanggal (null bila belum ditandai). */
export async function fastingStatusFor(dateKey: string): Promise<LocalFastingDay | undefined> {
  const profileId = await getActiveProfileId();
  return db.fasting_days.get(`${profileId}:${dateKey}`);
}

export async function isFastingToday(): Promise<boolean> {
  return (await fastingStatusFor(todayKey()))?.status === "fasting";
}

export async function setLocation(latitude: number, longitude: number): Promise<void> {
  await saveFastingSettings({ latitude, longitude });
}

/** Gabung koreksi ihtiyati ±menit per waktu (menutup selisih vs Kemenag, §10). */
export async function setTimeCorrection(patch: Record<string, number>): Promise<void> {
  const s = await getFastingSettings();
  await saveFastingSettings({ timeCorrection: { ...s.timeCorrection, ...patch } });
}

/** Ambil koordinat perangkat via Geolocation API (izin diminta browser). */
export function captureGeolocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolokasi tidak didukung perangkat ini"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  });
}

/** Set status puasa hari ini (toggle diam — tanpa alasan, §2 aturan 2). */
export async function setTodayFasting(status: "fasting" | "not_fasting", fastingType = "ramadan"): Promise<void> {
  const profileId = await getActiveProfileId();
  const dateKey = todayKey();
  const id = `${profileId}:${dateKey}`;
  const row: LocalFastingDay = { id, profileId, date: dateKey, fastingType, status, confirmed: true };
  await db.transaction("rw", db.fasting_days, db.outbox, async () => {
    await db.fasting_days.put(row);
    await enqueueDay(id);
  });
  void flushOutbox();
}
