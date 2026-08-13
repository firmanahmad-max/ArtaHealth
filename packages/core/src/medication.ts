/**
 * Medicine Reminder — helper jadwal obat deterministik (blueprint §3, F3).
 *
 * ⚠️ Aplikasi TIDAK PERNAH menyarankan waktu/dosis obat (CONTEXT §4). Engine ini
 *    hanya mengolah jadwal yang DIISI USER: kapan dosis berikutnya, dan apakah
 *    ada dosis yang jatuh di jam puasa (addendum-ramadan §3.3) — untuk diarahkan
 *    ke dokter/apoteker, bukan diubah otomatis.
 */

export interface MedicationSchedule {
  /** waktu dosis "HH:MM" (24 jam) */
  times: string[];
  /** hari berlaku (ISO 1=Sen..7=Min); kosong/undefined = tiap hari */
  days?: number[];
}

/** "HH:MM" → menit sejak tengah malam (0–1439), atau null bila format salah. */
export function parseTimeToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Jadwal berlaku pada hari ini? days kosong = tiap hari. */
export function scheduledOnDay(days: number[] | undefined, isoWeekday: number): boolean {
  return !days || days.length === 0 || days.includes(isoWeekday);
}

/**
 * Waktu dosis yang JATUH di jendela puasa [imsakMin, maghribMin) (§3.3). Waktu tak
 * valid diabaikan. Mengembalikan daftar "HH:MM" yang bentrok (urut sesuai input).
 */
export function fastingScheduleConflicts(
  times: string[], imsakMin: number, maghribMin: number,
): string[] {
  return times.filter((t) => {
    const m = parseTimeToMinutes(t);
    return m !== null && m >= imsakMin && m < maghribMin;
  });
}

/**
 * Dosis berikutnya (menit) pada/`setelah` nowMin di antara `times` hari ini.
 * Null bila semua dosis hari ini sudah lewat. Waktu invalid diabaikan.
 */
export function nextDoseMinutes(times: string[], nowMin: number): number | null {
  const upcoming = times
    .map(parseTimeToMinutes)
    .filter((m): m is number => m !== null && m >= nowMin)
    .sort((a, b) => a - b);
  return upcoming[0] ?? null;
}
