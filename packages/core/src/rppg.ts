/**
 * Cek Nadi via kamera (rPPG) — Fase 6 #3, RP-1. Engine DETERMINISTIK estimasi denyut
 * (BPM) dari deret sampel warna per-frame. Bukan alat medis, bukan diagnosis — hanya
 * estimasi kasar untuk kesadaran diri (lihat docs/addendum-rppg.md).
 *
 * Pipeline (tanpa lib eksternal): estimasi fs dari timestamp → bandpass murah
 * (beda moving-average) → autokorelasi pada rentang lag denyut → puncak + interpolasi
 * parabolik → BPM. Confidence = autokorelasi ternormalisasi di puncak (0..1).
 *
 * Agnostik sumber: sampel bisa dari ujung jari+flash (RP-1) atau wajah (iterasi lanjut).
 */

export interface RppgSample {
  /** waktu (ms, mis. performance.now / Date.now). */
  t: number;
  /** rata-rata satu kanal warna frame (0..255), biasanya kanal merah. */
  value: number;
}

export interface RppgConfig {
  minBpm: number;          // default 40
  maxBpm: number;          // default 200
  minDurationSec: number;  // default 8
  minFs: number;           // default 10 (Hz)
  okConfidence: number;    // default 0.5 → "ok"
  weakConfidence: number;  // default 0.3 → "low_quality" (di bawah ini insufficient sinyal)
}

export const DEFAULT_RPPG_CONFIG: RppgConfig = {
  minBpm: 40, maxBpm: 200, minDurationSec: 8, minFs: 10, okConfidence: 0.5, weakConfidence: 0.3,
};

export type RppgStatus = "ok" | "low_quality" | "insufficient";

export interface RppgResult {
  status: RppgStatus;
  bpm: number | null;      // terisi saat "ok"; boleh terisi (tapi tak andal) saat "low_quality"; null saat "insufficient"
  confidence: number;      // 0..1 (periodisitas sinyal)
  fs: number;              // laju sampel Hz
  durationSec: number;
  samples: number;
}

const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

/** Moving average simetris (window ganjil dibulatkan) — dipakai untuk bandpass murah. */
function movingAverage(x: number[], win: number): number[] {
  const n = x.length;
  const w = Math.max(1, Math.floor(win));
  if (w <= 1) return x.slice();
  const half = Math.floor(w / 2);
  const out = new Array<number>(n);
  // prefix sum untuk O(n)
  const pre = new Array<number>(n + 1);
  pre[0] = 0;
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i]! + x[i]!;
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    out[i] = (pre[hi + 1]! - pre[lo]!) / (hi - lo + 1);
  }
  return out;
}

/** Bandpass murah: highpass (buang baseline) lalu lowpass (buang derau). */
function bandpass(x: number[], fs: number, minBpm: number, maxBpm: number): number[] {
  const longWin = Math.round((fs * 60) / minBpm);   // periode denyut terlambat
  const shortWin = Math.max(1, Math.round((fs * 60) / maxBpm / 2)); // < setengah periode tercepat
  const baseline = movingAverage(x, longWin);
  const hp = x.map((v, i) => v - baseline[i]!);
  return movingAverage(hp, shortWin);
}

/**
 * Estimasi denyut (BPM) dari sampel rPPG. Menolak menebak saat data kurang/berkualitas
 * rendah (status insufficient/low_quality) — bpm hanya untuk status "ok".
 */
export function estimateHeartRate(samples: RppgSample[], config: Partial<RppgConfig> = {}): RppgResult {
  const cfg = { ...DEFAULT_RPPG_CONFIG, ...config };
  const clean = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.value));
  const n = clean.length;
  if (n < 2) {
    return { status: "insufficient", bpm: null, confidence: 0, fs: 0, durationSec: 0, samples: n };
  }

  clean.sort((a, b) => a.t - b.t);
  const durationSec = (clean[n - 1]!.t - clean[0]!.t) / 1000;
  const fs = durationSec > 0 ? (n - 1) / durationSec : 0;

  if (durationSec < cfg.minDurationSec || fs < cfg.minFs) {
    return { status: "insufficient", bpm: null, confidence: 0, fs, durationSec, samples: n };
  }

  // Preprocess
  const raw = clean.map((s) => s.value);
  const filtered = bandpass(raw, fs, cfg.minBpm, cfg.maxBpm);
  const m = mean(filtered);
  const x = filtered.map((v) => v - m);

  // Energi (r0) untuk normalisasi autokorelasi
  let r0 = 0;
  for (const v of x) r0 += v * v;
  if (r0 <= 0) {
    return { status: "low_quality", bpm: null, confidence: 0, fs, durationSec, samples: n };
  }

  const lagMin = Math.max(1, Math.floor((fs * 60) / cfg.maxBpm));
  const lagMax = Math.min(x.length - 1, Math.ceil((fs * 60) / cfg.minBpm));

  let bestLag = -1;
  let bestVal = -Infinity;
  const rAt = (lag: number): number => {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i]! * x[i + lag]!;
    return s / r0;
  };
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const r = rAt(lag);
    if (r > bestVal) { bestVal = r; bestLag = lag; }
  }

  if (bestLag < 1 || bestVal <= 0) {
    return { status: "low_quality", bpm: null, confidence: Math.max(0, bestVal), fs, durationSec, samples: n };
  }

  // Interpolasi parabolik di sekitar puncak → lag sub-sampel
  let lagRefined = bestLag;
  if (bestLag > lagMin && bestLag < lagMax) {
    const ym1 = rAt(bestLag - 1), y0 = bestVal, yp1 = rAt(bestLag + 1);
    const denom = ym1 - 2 * y0 + yp1;
    if (denom !== 0) {
      const delta = (0.5 * (ym1 - yp1)) / denom;
      if (delta > -1 && delta < 1) lagRefined = bestLag + delta;
    }
  }

  const bpm = (60 * fs) / lagRefined;
  const confidence = Math.min(1, Math.max(0, bestVal));

  if (confidence < cfg.weakConfidence) {
    return { status: "low_quality", bpm: null, confidence, fs, durationSec, samples: n };
  }
  if (confidence < cfg.okConfidence) {
    return { status: "low_quality", bpm: Math.round(bpm), confidence, fs, durationSec, samples: n };
  }
  return { status: "ok", bpm: Math.round(bpm), confidence, fs, durationSec, samples: n };
}
