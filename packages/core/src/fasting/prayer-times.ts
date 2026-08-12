/**
 * Engine Waktu Salat / Imsakiyah — deterministik, client-side, offline
 * (addendum-ramadan.md §4). Menghitung imsak/subuh/terbit/dzuhur/asar/maghrib/
 * isya dari koordinat + tanggal + zona waktu, memakai algoritma astronomi
 * standar (metode PrayTimes / Meeus low-precision) dengan sudut Kemenag:
 * Subuh 20°, Isya 18°. Imsak = subuh − 10 menit (konvensi Kemenag).
 *
 * ⚠️ AKURASI WAJIB DIVALIDASI vs jadwal Kemenag ≥5 kota (termasuk Samarinda),
 *    toleransi ±2 menit (checklist §10) sebelum menggerakkan fitur ke pengguna.
 *    Koreksi manual ±menit per waktu tersedia (fasting_settings.time_correction)
 *    untuk menutup selisih ihtiyati lokal.
 *
 * Semua waktu dikembalikan sebagai MENIT sejak tengah malam lokal (integer),
 * agar mudah dibandingkan & dirender tanpa bergantung objek Date/timezone.
 */

export type PrayerName = "imsak" | "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PrayerParams {
  /** sudut subuh di bawah ufuk (°). Default 20 (Kemenag). */
  fajrAngle: number;
  /** sudut isya di bawah ufuk (°). Default 18 (Kemenag). */
  ishaAngle: number;
  /** menit imsak sebelum subuh. Default 10 (Kemenag). */
  imsakOffsetMin: number;
  /** faktor bayangan asar: 1 = Syafi'i (default Indonesia), 2 = Hanafi. */
  asrFactor: number;
  /** koreksi manual ±menit per waktu (ihtiyati / kalibrasi lokal). */
  corrections?: Partial<Record<PrayerName, number>>;
}

/** Default Kemenag (Indonesia). */
export const KEMENAG_PARAMS: PrayerParams = {
  fajrAngle: 20,
  ishaAngle: 18,
  imsakOffsetMin: 10,
  asrFactor: 1,
};

export type PrayerTimes = Record<PrayerName, number>; // menit sejak tengah malam lokal

// ── Trigonometri berbasis derajat ───────────────────────────────────────────
const dtr = (d: number) => (d * Math.PI) / 180;
const rtd = (r: number) => (r * 180) / Math.PI;
const dSin = (d: number) => Math.sin(dtr(d));
const dCos = (d: number) => Math.cos(dtr(d));
const dTan = (d: number) => Math.tan(dtr(d));
const dAsin = (x: number) => rtd(Math.asin(x));
const dAcos = (x: number) => rtd(Math.acos(x));
const dAtan2 = (y: number, x: number) => rtd(Math.atan2(y, x));
const dAcot = (x: number) => rtd(Math.atan2(1, x));
const fixAngle = (a: number) => ((a % 360) + 360) % 360;
const fixHour = (h: number) => ((h % 24) + 24) % 24;

/** Julian Day untuk tengah malam UT tanggal Gregorian. */
function julianDay(year: number, month: number, day: number): number {
  if (month <= 2) { year -= 1; month += 12; }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

/** Deklinasi matahari (°) & equation of time (jam) untuk Julian Day tertentu. */
function sunPosition(jd: number): { declination: number; equationOfTime: number } {
  const d = jd - 2451545.0; // hari sejak J2000
  const g = fixAngle(357.529 + 0.98560028 * d); // anomali rata-rata
  const q = fixAngle(280.459 + 0.98564736 * d); // bujur rata-rata
  const l = fixAngle(q + 1.915 * dSin(g) + 0.02 * dSin(2 * g)); // bujur ekliptika
  const e = 23.439 - 0.00000036 * d; // kemiringan sumbu
  const declination = dAsin(dSin(e) * dSin(l));
  const ra = dAtan2(dCos(e) * dSin(l), dCos(l)) / 15; // right ascension (jam)
  const equationOfTime = q / 15 - fixHour(ra);
  return { declination, equationOfTime };
}

export interface PrayerInput {
  /** tanggal LOKAL */
  year: number; month: number; day: number;
  coords: Coordinates;
  /** offset zona waktu dari UTC dalam jam (WIB +7, WITA +8, WIT +9). */
  timezoneOffset: number;
  params?: Partial<PrayerParams>;
}

/**
 * Hitung seluruh waktu salat + imsak untuk satu hari & lokasi.
 * Satu iterasi estimasi (metode PrayTimes) — akurasi ~1 menit di lintang
 * Indonesia (dekat khatulistiwa). Mengembalikan menit sejak tengah malam lokal.
 */
export function computePrayerTimes(input: PrayerInput): PrayerTimes {
  const p: PrayerParams = { ...KEMENAG_PARAMS, ...input.params };
  const { latitude: lat, longitude: lng } = input.coords;
  const tz = input.timezoneOffset;

  // referensikan posisi matahari ke bujur lokal
  const jDate = julianDay(input.year, input.month, input.day) - lng / (15 * 24);

  // sudut terbit/terbenam: −0.833° (refraksi + jari-jari cakram matahari)
  const riseSetAngle = 0.833;

  // estimasi awal (jam) untuk evaluasi posisi matahari per-waktu
  const est = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };

  const midDay = (t: number): number => {
    const { equationOfTime } = sunPosition(jDate + t / 24);
    return fixHour(12 - equationOfTime);
  };
  // waktu saat matahari pada sudut `angle` relatif ufuk; dir −1 sebelum dzuhur, +1 sesudah
  const sunAngleTime = (angle: number, t: number, dir: -1 | 1): number => {
    const { declination: decl } = sunPosition(jDate + t / 24);
    const noon = midDay(t);
    const cosT = (-dSin(angle) - dSin(lat) * dSin(decl)) / (dCos(lat) * dCos(decl));
    const hourAngle = dAcos(cosT) / 15; // jam
    return noon + dir * hourAngle;
  };
  const asrTime = (factor: number, t: number): number => {
    const { declination: decl } = sunPosition(jDate + t / 24);
    const angle = -dAcot(factor + dTan(Math.abs(lat - decl)));
    return sunAngleTime(angle, t, 1);
  };

  // hitung mentah (jam, frame bujur-netral)
  let fajr = sunAngleTime(p.fajrAngle, est.fajr, -1);
  let sunrise = sunAngleTime(riseSetAngle, est.sunrise, -1);
  let dhuhr = midDay(est.dhuhr);
  let asr = asrTime(p.asrFactor, est.asr);
  let maghrib = sunAngleTime(riseSetAngle, est.maghrib, 1);
  let isha = sunAngleTime(p.ishaAngle, est.isha, 1);

  // sesuaikan ke waktu lokal: + (timezone − bujur/15)
  const adjust = tz - lng / 15;
  fajr += adjust; sunrise += adjust; dhuhr += adjust; asr += adjust; maghrib += adjust; isha += adjust;

  let imsak = fajr - p.imsakOffsetMin / 60;

  // koreksi manual ±menit
  const c = p.corrections ?? {};
  const toMin = (hours: number, name: PrayerName): number =>
    Math.round(hours * 60) + (c[name] ?? 0);

  return {
    imsak: toMin(imsak, "imsak"),
    fajr: toMin(fajr, "fajr"),
    sunrise: toMin(sunrise, "sunrise"),
    dhuhr: toMin(dhuhr, "dhuhr"),
    asr: toMin(asr, "asr"),
    maghrib: toMin(maghrib, "maghrib"),
    isha: toMin(isha, "isha"),
  };
}

/** Menit sejak tengah malam → "HH:MM" (24 jam, dua digit). */
export function formatTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
