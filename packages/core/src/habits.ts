import { z } from "zod";

/**
 * Habit engine V1 — deterministik (CONTEXT §3).
 * Aturan streak (desain memaafkan, CONTEXT §4 + ui-ux §3.4):
 * - Satu hari dihitung bila ≥1 habit terjadwal selesai hari itu.
 * - Hari TANPA habit terjadwal = transparan (di-skip, tidak memutus).
 * - Hari ini yang belum ada centang tidak memutus (harinya belum selesai).
 * - Bolos (ada jadwal, nol centang, bukan hari ini) memutus hitungan.
 * Catatan F3: hari uzur puasa juga akan transparan — via konteks hari, bukan pengecualian UI.
 */

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Nama kebiasaan wajib diisi").max(80),
  icon: z.string().max(8).optional(),
  /** ISO weekday 1=Senin … 7=Minggu */
  scheduleDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
});
export type HabitInput = z.infer<typeof habitSchema>;

export interface HabitScheduleJson {
  days?: unknown;
}

/** ISO weekday (1=Sen..7=Min) dari dateKey "YYYY-MM-DD" — kalender, bebas zona. */
export function isoWeekdayOf(dateKey: string): number {
  const js = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Jadwal kosong/invalid dianggap "setiap hari" (kompatibel default DB `{"days":[1..7]}`). */
export function isScheduledOn(schedule: HabitScheduleJson | null | undefined, isoWeekday: number): boolean {
  const days = schedule?.days;
  return Array.isArray(days) ? days.includes(isoWeekday) : true;
}

export interface StreakDay {
  /** "YYYY-MM-DD"; urut MUNDUR dari hari ini (indeks 0 = hari ini) */
  dateKey: string;
  scheduledCount: number;
  completedCount: number;
}

export function computeStreak(days: StreakDay[]): number {
  let streak = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i]!;
    if (d.scheduledCount === 0) continue; // transparan
    if (d.completedCount > 0) {
      streak++;
    } else if (i === 0) {
      continue; // hari ini belum selesai — belum memutus
    } else {
      break;
    }
  }
  return streak;
}
