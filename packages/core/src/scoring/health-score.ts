/**
 * Health Score Engine — deterministik, bukan LLM.
 * Sumber kebenaran: docs/technical-blueprint.md §4 + CONTEXT.md §6.
 * Bobot: tidur 30% · hidrasi 20% · aktivitas 25% · mood 10% · habit 15%.
 * Parameter tanpa data → bobotnya diredistribusi proporsional (tidak menghukum).
 */

export interface DayInputs {
  sleep?: {
    durationMin: number;
    /** deviasi jam tidur vs rata-rata 7 hari (menit); opsional */
    bedtimeDeviationMin?: number;
  };
  hydration?: { intakeMl: number; targetMl: number };
  activity?: {
    steps: number;
    stepTarget: number;
    /** menit olahraga terstruktur; jika ada, dihitung blend 60/40 (target 22 mnt/hari ≈ WHO 150/mgg) */
    exerciseMin?: number;
  };
  mood?: 1 | 2 | 3 | 4 | 5;
  habits?: { completed: number; total: number };
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
}

export interface HealthScoreResult {
  score: number; // 0–100, integer
  breakdown: ScoreBreakdown;
}

const BASE_WEIGHTS = { sleep: 0.3, hydration: 0.2, activity: 0.25, mood: 0.1, habit: 0.15 } as const;
type Param = keyof typeof BASE_WEIGHTS;

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** 7–9 jam (420–540 mnt) = 100; penalti linear 0.4 poin/menit di luar rentang.
 *  Deviasi jam tidur >45 mnt → penalti hingga 20 poin. */
export function sleepSubScore(durationMin: number, bedtimeDeviationMin?: number): number {
  let s: number;
  if (durationMin >= 420 && durationMin <= 540) s = 100;
  else {
    const outside = durationMin < 420 ? 420 - durationMin : durationMin - 540;
    s = clamp(100 - outside * 0.4);
  }
  if (bedtimeDeviationMin !== undefined && bedtimeDeviationMin > 45) {
    s = clamp(s - Math.min(20, (bedtimeDeviationMin - 45) * 0.2));
  }
  return s;
}

export function hydrationSubScore(intakeMl: number, targetMl: number): number {
  if (targetMl <= 0) return 0;
  return clamp((intakeMl / targetMl) * 100);
}

export function activitySubScore(steps: number, stepTarget: number, exerciseMin?: number): number {
  const stepScore = stepTarget > 0 ? clamp((steps / stepTarget) * 100) : 0;
  if (exerciseMin === undefined) return stepScore;
  const exScore = clamp((exerciseMin / 22) * 100);
  return clamp(0.6 * stepScore + 0.4 * exScore);
}

export const moodSubScore = (mood: number): number => clamp(mood * 20);

export function habitSubScore(completed: number, total: number): number {
  if (total <= 0) return 0;
  return clamp((completed / total) * 100);
}

export function computeHealthScore(inputs: DayInputs): HealthScoreResult {
  const raw: ScoreBreakdown["raw"] = {};
  if (inputs.sleep) raw.sleep = sleepSubScore(inputs.sleep.durationMin, inputs.sleep.bedtimeDeviationMin);
  if (inputs.hydration) raw.hydration = hydrationSubScore(inputs.hydration.intakeMl, inputs.hydration.targetMl);
  if (inputs.activity)
    raw.activity = activitySubScore(inputs.activity.steps, inputs.activity.stepTarget, inputs.activity.exerciseMin);
  if (inputs.mood !== undefined) raw.mood = moodSubScore(inputs.mood);
  if (inputs.habits) raw.habit = habitSubScore(inputs.habits.completed, inputs.habits.total);

  const present = (Object.keys(raw) as Param[]).filter((k) => raw[k] !== undefined);
  const breakdown: ScoreBreakdown = {
    sleep: "no_data", hydration: "no_data", activity: "no_data", mood: "no_data", habit: "no_data", raw,
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
