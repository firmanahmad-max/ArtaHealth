/**
 * Kesehatan Siklus / menstruasi (V3-5) — prediksi DETERMINISTIK dari riwayat tanggal
 * haid: panjang siklus rata-rata, hari siklus saat ini, fase perkiraan, perkiraan haid
 * berikutnya & jendela subur. Semua "perkiraan".
 *
 * ⚠️ BUKAN alat kontrasepsi, bukan diagnosis, bukan nasihat medis. Jendela subur =
 * estimasi kasar model rata-rata; JANGAN dijadikan dasar mencegah/merencanakan kehamilan.
 */

export const CYCLE_DISCLAIMER =
  "Perkiraan berdasarkan riwayatmu — bukan alat kontrasepsi, bukan diagnosis. " +
  "Siklus nyata bisa berbeda; untuk keputusan kesehatan reproduksi, konsultasikan dengan tenaga kesehatan.";

export interface PeriodLog {
  startISO: string;       // tanggal mulai haid
  lengthDays?: number;    // durasi haid (opsional)
}

export interface CycleConfig {
  defaultCycleDays: number;   // 28
  defaultPeriodDays: number;  // 5
  minCycle: number;           // 21 (batas bawah interval wajar)
  maxCycle: number;           // 40 (batas atas; interval di luar ini diabaikan = log terlewat)
  lutealDays: number;         // 14 (fase luteal ~ tetap)
  regularSdMax: number;       // 3 (sd interval ≤ ini → dianggap teratur)
}
export const DEFAULT_CYCLE_CONFIG: CycleConfig = {
  defaultCycleDays: 28, defaultPeriodDays: 5, minCycle: 21, maxCycle: 40, lutealDays: 14, regularSdMax: 3,
};

const DAY = 86_400_000;
const dayStr = (iso: string): string => iso.slice(0, 10);
const startMs = (iso: string): number => new Date(`${dayStr(iso)}T00:00:00.000Z`).getTime();
const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sd = (a: number[]): number => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
const addDaysISO = (baseMs: number, days: number): string => new Date(baseMs + days * DAY).toISOString();

export interface CycleStats {
  avgCycleDays: number;
  avgPeriodDays: number;
  cyclesCounted: number;   // jumlah interval antar-haid yang dipakai
  regular: boolean;
}

/** Rata-rata panjang siklus & durasi haid dari riwayat (interval di luar wajar diabaikan). */
export function cycleStats(periods: PeriodLog[], config: Partial<CycleConfig> = {}): CycleStats {
  const cfg = { ...DEFAULT_CYCLE_CONFIG, ...config };
  const starts = [...new Set(periods.map((p) => dayStr(p.startISO)))].sort().map((d) => startMs(d));
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const d = Math.round((starts[i]! - starts[i - 1]!) / DAY);
    if (d >= cfg.minCycle && d <= cfg.maxCycle) intervals.push(d);
  }
  const lengths = periods.map((p) => p.lengthDays).filter((n): n is number => typeof n === "number" && n > 0);
  return {
    avgCycleDays: intervals.length ? Math.round(mean(intervals)) : cfg.defaultCycleDays,
    avgPeriodDays: lengths.length ? Math.round(mean(lengths)) : cfg.defaultPeriodDays,
    cyclesCounted: intervals.length,
    regular: intervals.length >= 2 && sd(intervals) <= cfg.regularSdMax,
  };
}

export type CyclePhase = "menstruation" | "follicular" | "fertile" | "luteal" | "late" | "unknown";

export interface CyclePrediction {
  lastStartISO: string;
  cycleDay: number;          // hari ke-berapa dalam siklus (1-based)
  cycleLength: number;
  phase: CyclePhase;
  nextPeriodISO: string;
  daysUntilNext: number;     // bisa negatif bila telat
  ovulationISO: string | null;
  fertileWindow: { startISO: string; endISO: string } | null;
  regular: boolean;
}

/** Prediksi siklus saat ini. null bila belum ada riwayat haid. */
export function predictCycle(
  periods: PeriodLog[], nowMs: number = Date.now(), config: Partial<CycleConfig> = {},
): CyclePrediction | null {
  const cfg = { ...DEFAULT_CYCLE_CONFIG, ...config };
  if (periods.length === 0) return null;
  const stats = cycleStats(periods, cfg);
  const lastStartMs = Math.max(...periods.map((p) => startMs(p.startISO)));
  const cycleLength = stats.avgCycleDays;

  const cycleDay = Math.floor((nowMs - lastStartMs) / DAY) + 1;
  const nextMs = lastStartMs + cycleLength * DAY;
  const daysUntilNext = Math.round((nextMs - nowMs) / DAY);

  // Ovulasi ~ (panjang siklus − fase luteal); jendela subur [ovulasi−5, ovulasi+1].
  const ovulationDay = Math.max(1, cycleLength - cfg.lutealDays);   // 1-based
  const ovulationMs = lastStartMs + (ovulationDay - 1) * DAY;
  const fertileStartDay = ovulationDay - 5;
  const fertileEndDay = ovulationDay + 1;

  let phase: CyclePhase;
  if (cycleDay < 1) phase = "unknown";
  else if (cycleDay > cycleLength) phase = "late";
  else if (cycleDay <= stats.avgPeriodDays) phase = "menstruation";
  else if (cycleDay >= fertileStartDay && cycleDay <= fertileEndDay) phase = "fertile";
  else if (cycleDay < fertileStartDay) phase = "follicular";
  else phase = "luteal";

  return {
    lastStartISO: addDaysISO(lastStartMs, 0),
    cycleDay, cycleLength, phase,
    nextPeriodISO: addDaysISO(nextMs, 0),
    daysUntilNext,
    ovulationISO: addDaysISO(ovulationMs, 0),
    fertileWindow: {
      startISO: addDaysISO(lastStartMs, fertileStartDay - 1),
      endISO: addDaysISO(lastStartMs, fertileEndDay - 1),
    },
    regular: stats.regular,
  };
}

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstruation: "Menstruasi", follicular: "Folikuler", fertile: "Masa subur (perkiraan)",
  luteal: "Luteal", late: "Telat", unknown: "—",
};
