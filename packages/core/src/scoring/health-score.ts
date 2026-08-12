/**
 * Health Score Engine — deterministik, bukan LLM.
 * Sumber kebenaran: docs/technical-blueprint.md §4 + CONTEXT.md §6.
 * Bobot: tidur 30% · hidrasi 20% · aktivitas 25% · mood 10% · habit 15%.
 * Parameter tanpa data → bobotnya diredistribusi proporsional (tidak menghukum).
 */

export interface DayInputs {
  sleep?: {
    /** hari puasa: durasi AGREGAT semua sesi (malam + pasca-subuh + qailulah) */
    durationMin: number;
    /** deviasi jam tidur vs baseline (7 hari normal / baseline Ramadan saat puasa); opsional */
    bedtimeDeviationMin?: number;
  };
  hydration?: {
    intakeMl: number;
    targetMl: number;
    /** jumlah sesi minum — hari puasa: ≥3 sesi (pola 2-4-2) memudahkan skor penuh */
    sessions?: number;
  };
  activity?: {
    /** boleh kosong bila user hanya mencatat durasi olahraga */
    steps?: number;
    stepTarget: number;
    /** menit olahraga terstruktur; jika ada, dihitung blend 60/40 (target 22 mnt/hari ≈ WHO 150/mgg) */
    exerciseMin?: number;
  };
  mood?: 1 | 2 | 3 | 4 | 5;
  habits?: { completed: number; total: number };
  /**
   * Hari puasa (fasting_days.status='fasting', addendum-ramadan §5): normalisasi
   * sub-skor berubah (tidur rentang 6–9j agregat, hidrasi jendela+bonus distribusi,
   * langkah ×0,7) — BOBOT TETAP. Hari not_fasting → biarkan false (normalisasi normal).
   */
  fasting?: boolean;
}

export interface ScoreBreakdown {
  /** kontribusi terboboti per parameter, atau "no_data" */
  sleep: number | "no_data";
  hydration: number | "no_data";
  activity: number | "no_data";
  mood: number | "no_data";
  habit: number | "no_data";
  /** sub-skor mentah 0–100 sebelum bobot */
  raw: Partial<Record<"sleep" | "hydration" | "activity" | "mood" | "habit", number>>;
  /** "fasting" pada hari puasa → UI beri badge 🌙 & shading tren tahunan */
  context?: "fasting";
}

export interface HealthScoreResult {
  score: number; // 0–100, integer
  breakdown: ScoreBreakdown;
}

const BASE_WEIGHTS = { sleep: 0.3, hydration: 0.2, activity: 0.25, mood: 0.1, habit: 0.15 } as const;
type Param = keyof typeof BASE_WEIGHTS;

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** Normal 7–9 jam (420–540 mnt) = 100; hari puasa rentang sehat 6–9 jam agregat
 *  (batas bawah 360). Penalti linear 0,4 poin/menit di luar rentang. Deviasi jam
 *  tidur >45 mnt → penalti hingga 20 poin (baseline dihitung upstream). */
export function sleepSubScore(durationMin: number, bedtimeDeviationMin?: number, fasting = false): number {
  const lowBound = fasting ? 360 : 420; // hari puasa: bangun sahur tak dihukum sbg kurang tidur
  let s: number;
  if (durationMin >= lowBound && durationMin <= 540) s = 100;
  else {
    const outside = durationMin < lowBound ? lowBound - durationMin : durationMin - 540;
    s = clamp(100 - outside * 0.4);
  }
  if (bedtimeDeviationMin !== undefined && bedtimeDeviationMin > 45) {
    s = clamp(s - Math.min(20, (bedtimeDeviationMin - 45) * 0.2));
  }
  return s;
}

/** Proporsional & di-cap 100. Hari puasa: intake tersebar ≥3 sesi (pola 2-4-2)
 *  dapat bonus distribusi +10 → skor penuh lebih mudah tanpa menghukum single-dump. */
export function hydrationSubScore(intakeMl: number, targetMl: number, fasting = false, sessions?: number): number {
  if (targetMl <= 0) return 0;
  let s = clamp((intakeMl / targetMl) * 100);
  if (fasting && (sessions ?? 0) >= 3) s = clamp(s + 10);
  return s;
}

/** Hari puasa: target langkah ×0,7 (aktivitas siang puasa dikalibrasi turun).
 *  exerciseMin diasumsikan sudah difilter ke jendela aman oleh pemanggil. */
export function activitySubScore(steps: number | undefined, stepTarget: number, exerciseMin?: number, fasting = false): number {
  const effTarget = fasting ? stepTarget * 0.7 : stepTarget;
  const stepScore = steps !== undefined ? (effTarget > 0 ? clamp((steps / effTarget) * 100) : 0) : undefined;
  const exScore = exerciseMin !== undefined ? clamp((exerciseMin / 22) * 100) : undefined;
  // hanya satu jenis data → pakai itu saja (tidak menghukum data yang tak dicatat)
  if (stepScore === undefined) return exScore ?? 0;
  if (exScore === undefined) return stepScore;
  return clamp(0.6 * stepScore + 0.4 * exScore);
}

export const moodSubScore = (mood: number): number => clamp(mood * 20);

export function habitSubScore(completed: number, total: number): number {
  if (total <= 0) return 0;
  return clamp((completed / total) * 100);
}

export function computeHealthScore(inputs: DayInputs): HealthScoreResult {
  const fasting = inputs.fasting === true;
  const raw: ScoreBreakdown["raw"] = {};
  if (inputs.sleep) raw.sleep = sleepSubScore(inputs.sleep.durationMin, inputs.sleep.bedtimeDeviationMin, fasting);
  if (inputs.hydration) raw.hydration = hydrationSubScore(inputs.hydration.intakeMl, inputs.hydration.targetMl, fasting, inputs.hydration.sessions);
  if (inputs.activity && (inputs.activity.steps !== undefined || inputs.activity.exerciseMin !== undefined))
    raw.activity = activitySubScore(inputs.activity.steps, inputs.activity.stepTarget, inputs.activity.exerciseMin, fasting);
  if (inputs.mood !== undefined) raw.mood = moodSubScore(inputs.mood);
  if (inputs.habits) raw.habit = habitSubScore(inputs.habits.completed, inputs.habits.total);

  const present = (Object.keys(raw) as Param[]).filter((k) => raw[k] !== undefined);
  const breakdown: ScoreBreakdown = {
    sleep: "no_data", hydration: "no_data", activity: "no_data", mood: "no_data", habit: "no_data", raw,
    ...(fasting ? { context: "fasting" as const } : {}),
  };
  if (present.length === 0) return { score: 0, breakdown };

  // Redistribusi bobot parameter yang hilang, proporsional terhadap bobot dasar yang hadir.
  const presentBase = present.reduce((s, k) => s + BASE_WEIGHTS[k], 0);
  let total = 0;
  for (const k of present) {
    const w = BASE_WEIGHTS[k] / presentBase;
    const contrib = w * (raw[k] as number);
    breakdown[k] = Math.round(contrib * 10) / 10;
    total += contrib;
  }
  return { score: Math.round(clamp(total)), breakdown };
}
