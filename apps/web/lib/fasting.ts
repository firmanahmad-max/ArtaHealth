"use client";
import {
  computePrayerTimes, ramadanFastingProgress,
  gregorianToHijri, sunnahFastingOn, isoWeekdayOf,
  type PrayerTimes, type RamadanProgress, type HijriDate, type SunnahSchedule,
} from "@arta/core";
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

/** Mode Ramadan aktif untuk tanggal ini? (enabled + dateKey dalam [start,end]) */
export function isRamadanActiveOn(s: LocalFastingSettings, dateKey: string): boolean {
  return s.ramadanEnabled && s.ramadanStart != null && s.ramadanEnd != null &&
    dateKey >= s.ramadanStart && dateKey <= s.ramadanEnd;
}

/**
 * Status puasa EFEKTIF hari ini: baris eksplisit menang; bila tak ada & Mode
 * Ramadan aktif → DEFAULT puasa (§3.1 "Default 'Puasa' selama Ramadan").
 */
export async function isFastingToday(): Promise<boolean> {
  const key = todayKey();
  const row = await fastingStatusFor(key);
  if (row) return row.status === "fasting";
  return isRamadanActiveOn(await getFastingSettings(), key);
}

/** Aktifkan Mode Ramadan dengan tanggal (dikonfirmasi user — sidang isbat, §4). */
export async function enableRamadan(startDate: string, endDate: string, sahurReminderMin?: number): Promise<void> {
  await saveFastingSettings({
    ramadanEnabled: true, ramadanStart: startDate, ramadanEnd: endDate,
    ...(sahurReminderMin != null ? { sahurReminderMin } : {}),
  });
}

export async function disableRamadan(): Promise<void> {
  await saveFastingSettings({ ramadanEnabled: false });
}

/** Progres puasa Ramadan {fasted, elapsed} sampai hari ini (dijepit ke ramadan_end). */
export async function ramadanProgress(): Promise<RamadanProgress | null> {
  const s = await getFastingSettings();
  if (!s.ramadanEnabled || !s.ramadanStart || !s.ramadanEnd) return null;
  const profileId = await getActiveProfileId();
  const today = todayKey();
  const clampedToday = today > s.ramadanEnd ? s.ramadanEnd : today;
  if (clampedToday < s.ramadanStart) return { fasted: 0, elapsed: 0 };
  // between() Dexie: includeUpper default FALSE → sertakan kedua batas eksplisit
  const rows = await db.fasting_days.where("[profileId+date]")
    .between([profileId, s.ramadanStart], [profileId, clampedToday], true, true).toArray();
  const entries = rows.map((r) => ({ date: r.date, status: r.status }));
  return ramadanFastingProgress(entries, s.ramadanStart, clampedToday);
}

export async function setLocation(latitude: number, longitude: number): Promise<void> {
  await saveFastingSettings({ latitude, longitude });
}

/** Tandai interstitial keamanan medis pra-Ramadan (§3.3) sudah dibaca. */
export async function acknowledgeMedical(): Promise<void> {
  await saveFastingSettings({ medicalAckAt: new Date().toISOString() });
}

/** Simpan jadwal puasa sunnah yang diikuti user (§3.2). */
export async function setSunnahSchedules(schedules: SunnahSchedule[]): Promise<void> {
  await saveFastingSettings({ sunnahSchedules: schedules });
}

export interface SunnahInfo {
  hijri: HijriDate;
  /** jadwal sunnah yang JATUH hari ini (dari yang dipilih user) */
  hits: SunnahSchedule[];
  /** jadwal sunnah yang dipilih user */
  schedules: SunnahSchedule[];
}

/** Tanggal Hijriah hari ini + jadwal sunnah yang jatuh hari ini. */
export async function sunnahInfoToday(): Promise<SunnahInfo> {
  const s = await getFastingSettings();
  const key = todayKey();
  const [y, m, d] = key.split("-").map(Number);
  const schedules = (s.sunnahSchedules as SunnahSchedule[]) ?? [];
  return {
    hijri: gregorianToHijri(y!, m!, d!),
    hits: sunnahFastingOn(y!, m!, d!, isoWeekdayOf(key), schedules),
    schedules,
  };
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
