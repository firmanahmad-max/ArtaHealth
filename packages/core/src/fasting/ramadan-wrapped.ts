/**
 * Ramadan Wrapped (Fase 9 · RW-1) — rekap DETERMINISTIK akhir bulan puasa: hari berpuasa, rentetan
 * terpanjang, % penyelesaian, tingkat + headline hangat. MURNI (tanpa I/O) → teruji. Reuse konvensi
 * "default puasa kecuali ditandai not_fasting eksplisit" (sama dgn ramadanFastingProgress). NON-MEDIS
 * & NON-MENGHAKIMI (alasan tak-puasa yang sah — sehat/safar/haid — tak ditanya/dinilai).
 */

import type { FastingDayEntry } from "./streak.ts";

export interface RamadanWrappedInput {
  entries: FastingDayEntry[];   // catatan hari puasa (boleh di luar rentang; disaring)
  startDate: string;            // "YYYY-MM-DD" awal Ramadan
  endDate: string;              // "YYYY-MM-DD" akhir Ramadan (inklusif)
}

export type RamadanTier = "penuh" | "kuat" | "baik" | "mulai";

export interface RamadanWrapped {
  totalDays: number;       // panjang rentang [start, end] inklusif
  fastedDays: number;      // hari berpuasa (default puasa − not_fasting eksplisit)
  missedDays: number;      // hari ditandai not_fasting (mis. untuk diqadha)
  longestStreak: number;   // rentetan puasa berturut-turut terpanjang
  completionPct: number;   // 0..100
  tier: RamadanTier;
  headline: string;
}

const addDayUTC = (d: Date): Date => { d.setUTCDate(d.getUTCDate() + 1); return d; };

const HEADLINE: Record<RamadanTier, string> = {
  penuh: "Sebulan penuh! Alhamdulillah, Ramadan yang luar biasa. 🌙",
  kuat: "Ramadan yang kuat — konsistensi yang patut disyukuri. ✨",
  baik: "Ramadan yang baik. Setiap hari puasa berarti.",
  mulai: "Setiap langkah dihargai — semoga Ramadan berikutnya lebih lapang.",
};

const tierOf = (pct: number): RamadanTier =>
  pct >= 100 ? "penuh" : pct >= 80 ? "kuat" : pct >= 50 ? "baik" : "mulai";

/**
 * Rekap Ramadan dari rentang [startDate, endDate] inklusif. Default: tiap hari dianggap puasa
 * kecuali ada entri `not_fasting` eksplisit (konsisten dgn progress Fase 3). Rentang invalid → nol.
 */
export function ramadanWrapped(input: RamadanWrappedInput): RamadanWrapped {
  const { startDate, endDate } = input;
  if (!startDate || !endDate || endDate < startDate) {
    return { totalDays: 0, fastedDays: 0, missedDays: 0, longestStreak: 0, completionPct: 0, tier: "mulai", headline: HEADLINE.mulai };
  }
  const status = new Map(input.entries.map((e) => [e.date, e.status]));

  let total = 0, fasted = 0, missed = 0, longest = 0, run = 0;
  for (let cur = new Date(`${startDate}T00:00:00Z`); ; addDayUTC(cur)) {
    const key = cur.toISOString().slice(0, 10);
    if (key > endDate) break;
    total++;
    if (status.get(key) === "not_fasting") { missed++; run = 0; }
    else { fasted++; run++; if (run > longest) longest = run; }
  }

  const completionPct = total > 0 ? Math.round((fasted / total) * 100) : 0;
  const tier = tierOf(completionPct);
  return { totalDays: total, fastedDays: fasted, missedDays: missed, longestStreak: longest, completionPct, tier, headline: HEADLINE[tier] };
}
