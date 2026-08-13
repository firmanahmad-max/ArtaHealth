/**
 * Kalender Hijriah (tabular / algoritma Kuwaiti) + deteksi hari puasa sunnah
 * (addendum-ramadan §3.2) — deterministik, offline.
 *
 * ⚠️ Konversi TABULAR untuk TAMPILAN & SARAN. Bisa berbeda ±1–2 hari dari
 *    Umm al-Qura / rukyat. Karena itu tanggal krusial (awal Ramadan/Syawal)
 *    SELALU dikonfirmasi user (§4) — engine hanya menyarankan, tak memaksa.
 */

export interface HijriDate { year: number; month: number; day: number }

export const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabiul Awal", "Rabiul Akhir", "Jumadil Awal", "Jumadil Akhir",
  "Rajab", "Sya'ban", "Ramadan", "Syawal", "Zulkaidah", "Zulhijah",
] as const;

const g2jd = (gy: number, gm: number, gd: number): number =>
  Math.floor((1461 * (gy + 4800 + Math.floor((gm - 14) / 12))) / 4) +
  Math.floor((367 * (gm - 2 - 12 * Math.floor((gm - 14) / 12))) / 12) -
  Math.floor((3 * Math.floor((gy + 4900 + Math.floor((gm - 14) / 12)) / 100)) / 4) +
  gd - 32075;

function jd2hijri(jd: number): HijriDate {
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

/** Konversi tanggal Gregorian (bulan 1–12) ke Hijriah tabular. */
export function gregorianToHijri(gy: number, gm: number, gd: number): HijriDate {
  return jd2hijri(g2jd(gy, gm, gd));
}

/** "13 Ramadan 1448" */
export function formatHijri(h: HijriDate): string {
  return `${h.day} ${HIJRI_MONTHS[h.month - 1] ?? "?"} ${h.year}`;
}

export type SunnahSchedule =
  | "senin_kamis" | "ayyamul_bidh" | "syawal6" | "arafah" | "asyura" | "daud";

export const SUNNAH_LABELS: Record<SunnahSchedule, string> = {
  senin_kamis: "Senin–Kamis",
  ayyamul_bidh: "Ayyamul Bidh (13–15)",
  syawal6: "6 Hari Syawal",
  arafah: "Arafah (9 Zulhijah)",
  asyura: "Tasu'a–Asyura (9–10 Muharram)",
  daud: "Puasa Daud (selang-seling)",
};

/**
 * Jadwal sunnah mana yang JATUH pada tanggal ini (dari yang dipilih user).
 * `isoWeekday` 1=Senin..7=Minggu. Puasa Daud butuh acuan selang-seling → tak
 * dideteksi otomatis di sini (dikelola manual), sisanya deterministik dari Hijriah.
 */
export function sunnahFastingOn(
  gy: number, gm: number, gd: number, isoWeekday: number, schedules: SunnahSchedule[],
): SunnahSchedule[] {
  const h = gregorianToHijri(gy, gm, gd);
  const set = new Set(schedules);
  const hits: SunnahSchedule[] = [];
  if (set.has("senin_kamis") && (isoWeekday === 1 || isoWeekday === 4)) hits.push("senin_kamis");
  if (set.has("ayyamul_bidh") && h.day >= 13 && h.day <= 15) hits.push("ayyamul_bidh");
  if (set.has("arafah") && h.month === 12 && h.day === 9) hits.push("arafah");
  if (set.has("asyura") && h.month === 1 && (h.day === 9 || h.day === 10)) hits.push("asyura");
  // 6 hari Syawal: sarankan hari-hari awal Syawal (kecuali 1 Syawal = Idulfitri)
  if (set.has("syawal6") && h.month === 10 && h.day >= 2 && h.day <= 8) hits.push("syawal6");
  return hits;
}
