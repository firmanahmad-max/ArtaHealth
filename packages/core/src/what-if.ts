/**
 * Simulasi "Bagaimana Jika" (V3-2) — proyeksi Health Score DETERMINISTIK bila kebiasaan
 * berubah. Memakai ulang engine skor (computeHealthScore) pada baseline "hari khas"
 * (rata-rata terkini) + penyesuaian (levers). Bukan janji medis — memperlihatkan potensi
 * perubahan skor untuk memotivasi. Tak pernah menghukum; hanya menampilkan selisih.
 */

import { computeHealthScore, type DayInputs, type ScoreBreakdown } from "./scoring/health-score.ts";

export interface WhatIfLevers {
  sleepDeltaMin?: number;      // ± menit tidur
  hydrationDeltaMl?: number;   // ± ml air
  stepsDelta?: number;         // ± langkah
  exerciseDeltaMin?: number;   // ± menit olahraga
}

/** Terapkan penyesuaian ke baseline (clamp ke ≥0). Hanya faktor yang ADA di baseline
 *  yang diubah — kecuali olahraga, yang boleh muncul dari nol bila baseline aktivitas ada. */
export function applyLevers(base: DayInputs, levers: WhatIfLevers): DayInputs {
  const out: DayInputs = { ...base };
  if (base.sleep && levers.sleepDeltaMin) {
    out.sleep = { ...base.sleep, durationMin: Math.max(0, base.sleep.durationMin + levers.sleepDeltaMin) };
  }
  if (base.hydration && levers.hydrationDeltaMl) {
    out.hydration = { ...base.hydration, intakeMl: Math.max(0, base.hydration.intakeMl + levers.hydrationDeltaMl) };
  }
  if (base.activity && (levers.stepsDelta || levers.exerciseDeltaMin)) {
    out.activity = {
      ...base.activity,
      steps: base.activity.steps !== undefined
        ? Math.max(0, base.activity.steps + (levers.stepsDelta ?? 0))
        : base.activity.steps,
      exerciseMin: base.activity.exerciseMin !== undefined || levers.exerciseDeltaMin
        ? Math.max(0, (base.activity.exerciseMin ?? 0) + (levers.exerciseDeltaMin ?? 0))
        : base.activity.exerciseMin,
    };
  }
  return out;
}

export interface WhatIfProjection {
  baseScore: number;
  projectedScore: number;
  delta: number;              // projected − base (bisa 0 atau negatif bila lever memburuk)
  baseBreakdown: ScoreBreakdown;
  projectedBreakdown: ScoreBreakdown;
}

/** Proyeksikan skor bila levers diterapkan ke baseline. */
export function projectScore(base: DayInputs, levers: WhatIfLevers): WhatIfProjection {
  const b = computeHealthScore(base);
  const p = computeHealthScore(applyLevers(base, levers));
  return {
    baseScore: b.score,
    projectedScore: p.score,
    delta: p.score - b.score,
    baseBreakdown: b.breakdown,
    projectedBreakdown: p.breakdown,
  };
}

export interface WhatIfPreset {
  key: string;
  label: string;
  icon: string;
  levers: WhatIfLevers;
}

/** Skenario umum siap-pakai (positif = perbaikan kebiasaan). */
export const WHATIF_PRESETS: WhatIfPreset[] = [
  { key: "sleep+60", label: "Tidur +1 jam", icon: "🌙", levers: { sleepDeltaMin: 60 } },
  { key: "hydration+500", label: "Minum +2 gelas", icon: "💧", levers: { hydrationDeltaMl: 500 } },
  { key: "steps+3000", label: "Jalan +3.000 langkah", icon: "👟", levers: { stepsDelta: 3000 } },
  { key: "exercise+20", label: "Olahraga +20 menit", icon: "🏃", levers: { exerciseDeltaMin: 20 } },
];

/** Gabungkan beberapa preset jadi satu set levers (dijumlahkan). */
export function combineLevers(presets: WhatIfPreset[]): WhatIfLevers {
  const out: WhatIfLevers = {};
  for (const p of presets) {
    if (p.levers.sleepDeltaMin) out.sleepDeltaMin = (out.sleepDeltaMin ?? 0) + p.levers.sleepDeltaMin;
    if (p.levers.hydrationDeltaMl) out.hydrationDeltaMl = (out.hydrationDeltaMl ?? 0) + p.levers.hydrationDeltaMl;
    if (p.levers.stepsDelta) out.stepsDelta = (out.stepsDelta ?? 0) + p.levers.stepsDelta;
    if (p.levers.exerciseDeltaMin) out.exerciseDeltaMin = (out.exerciseDeltaMin ?? 0) + p.levers.exerciseDeltaMin;
  }
  return out;
}
