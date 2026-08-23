/**
 * Early Warning (Fase 6 #4) — deteksi anomali terhadap BASELINE PRIBADI pengguna,
 * DETERMINISTIK via z-score. Melengkapi Panel Risiko (ambang absolut/klinis): di sini
 * yang dinilai adalah PERUBAHAN relatif terhadap norma pengguna sendiri — "ada yang
 * bergeser untukmu", bahkan bila nilainya masih dalam rentang normal.
 *
 * Prinsip:
 *  - Bukan prediksi/AI — z-score murni, bisa dijelaskan angka per angka.
 *  - Butuh cukup data dulu (minBaseline) → kalau kurang, DIAM ("belum cukup data"),
 *    tak menebak. Mencegah alarm palsu di data jarang.
 *  - Membandingkan RATA-RATA jendela terkini vs baseline (geseran berkelanjutan),
 *    bukan satu titik bising.
 *  - Tidak pernah mendiagnosis; hanya menandai "layak diperhatikan / dicek".
 */

export interface EWPoint {
  /** ISO timestamp (di-parse via Date). */
  t: string;
  value: number;
}

export interface Baseline {
  n: number;
  mean: number;
  sd: number;   // simpangan baku sampel (n-1)
}

/** Baseline (mean + sd sampel) dari deret nilai. sd=0 bila n<2 atau semua sama. */
export function baselineOf(values: number[]): Baseline {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return { n, mean, sd: 0 };
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { n, mean, sd: Math.sqrt(variance) };
}

export type EWDirection = "rising" | "falling" | "flat";
export type EWSeverity = "none" | "watch" | "alert";
export type EWStatus = "insufficient" | "normal" | "anomaly";

export interface EWConfig {
  minBaseline: number;  // titik baseline minimum (default 10)
  minRecent: number;    // titik jendela terkini minimum (default 3)
  recentDays: number;   // panjang jendela "terkini" dalam hari (default 7)
  watchZ: number;       // ambang perhatian (default 2)
  alertZ: number;       // ambang waspada (default 3)
  flatEps: number;      // ambang |selisih| yang dianggap "flat" (default 1e-9)
}

export const DEFAULT_EW_CONFIG: EWConfig = {
  minBaseline: 10, minRecent: 3, recentDays: 7, watchZ: 2, alertZ: 3, flatEps: 1e-9,
};

export interface EWResult {
  status: EWStatus;
  severity: EWSeverity;
  direction: EWDirection;
  z: number | null;         // null bila baseline sd=0 (tak terdefinisi)
  baseline: Baseline | null;
  recentMean: number | null;
  recentN: number;
  baselineN: number;
  delta: number | null;     // recentMean - baseline.mean
}

const INSUFFICIENT = (baselineN: number, recentN: number): EWResult => ({
  status: "insufficient", severity: "none", direction: "flat", z: null,
  baseline: null, recentMean: null, recentN, baselineN, delta: null,
});

/**
 * Deteksi geseran deret waktu terhadap baseline pribadi.
 * `nowMs` = acuan "sekarang" (default Date.now()) — jendela terkini = [now-recentDays, now].
 */
export function detectEarlyWarning(
  points: EWPoint[],
  nowMs: number = Date.now(),
  config: Partial<EWConfig> = {},
): EWResult {
  const cfg = { ...DEFAULT_EW_CONFIG, ...config };
  const cutoff = nowMs - cfg.recentDays * 86_400_000;

  const recent: number[] = [];
  const base: number[] = [];
  for (const p of points) {
    const ms = new Date(p.t).getTime();
    if (Number.isNaN(ms) || !Number.isFinite(p.value)) continue;
    (ms >= cutoff ? recent : base).push(p.value);
  }

  if (base.length < cfg.minBaseline || recent.length < cfg.minRecent) {
    return INSUFFICIENT(base.length, recent.length);
  }

  const baseline = baselineOf(base);
  const recentMean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const delta = recentMean - baseline.mean;
  const direction: EWDirection =
    Math.abs(delta) <= cfg.flatEps ? "flat" : delta > 0 ? "rising" : "falling";

  // Baseline tanpa variasi (sd=0): setiap geseran nyata = waspada (z tak terdefinisi).
  if (baseline.sd === 0) {
    const anomaly = direction !== "flat";
    return {
      status: anomaly ? "anomaly" : "normal",
      severity: anomaly ? "alert" : "none",
      direction, z: null, baseline, recentMean,
      recentN: recent.length, baselineN: base.length, delta,
    };
  }

  const z = delta / baseline.sd;
  const az = Math.abs(z);
  const severity: EWSeverity = az >= cfg.alertZ ? "alert" : az >= cfg.watchZ ? "watch" : "none";

  return {
    status: severity === "none" ? "normal" : "anomaly",
    severity, direction, z, baseline, recentMean,
    recentN: recent.length, baselineN: base.length, delta,
  };
}
