/**
 * Korelasi lintas-metrik + laporan bulanan (V3-3). Cari HUBUNGAN antar-metrik harian
 * (mis. tidur ↔ mood) secara DETERMINISTIK (koefisien Pearson), lalu narasikan sebagai
 * POLA — bukan sebab-akibat, bukan diagnosis. AI hanya boleh memperhalus narasi nanti;
 * angka & deteksi pola selalu deterministik & bisa diuji.
 */

export interface DailyMetricPoint {
  day: string;   // "YYYY-MM-DD" lokal
  value: number;
}

/** Koefisien korelasi Pearson dua array berpasangan. null bila n<2 atau salah satu sd=0. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; }
  const mx = sx / n, my = sy / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    cov += dx * dy; vx += dx * dx; vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  const r = cov / Math.sqrt(vx * vy);
  return Math.max(-1, Math.min(1, r));
}

export type CorrelationStrength = "weak" | "moderate" | "strong";
export type CorrelationDirection = "positive" | "negative";

export interface Correlation {
  a: string;                    // key metrik A
  b: string;                    // key metrik B
  r: number;
  n: number;                    // jumlah pasangan hari
  strength: CorrelationStrength;
  direction: CorrelationDirection;
}

export interface CorrelationConfig {
  minPairs: number;   // pasangan hari minimum (default 8)
  minAbsR: number;    // ambang |r| untuk ditampilkan (default 0.4)
  top: number;        // maksimum korelasi ditampilkan (default 3)
}
export const DEFAULT_CORRELATION_CONFIG: CorrelationConfig = { minPairs: 8, minAbsR: 0.4, top: 3 };

const strengthOf = (ar: number): CorrelationStrength => (ar >= 0.7 ? "strong" : ar >= 0.4 ? "moderate" : "weak");

/** Korelasikan dua deret harian (dipasangkan berdasarkan hari yang sama). */
export function correlate(
  a: DailyMetricPoint[], b: DailyMetricPoint[], aKey: string, bKey: string,
  minPairs = DEFAULT_CORRELATION_CONFIG.minPairs,
): Correlation | null {
  const mapB = new Map(b.map((p) => [p.day, p.value]));
  const xs: number[] = [], ys: number[] = [];
  for (const p of a) {
    const bv = mapB.get(p.day);
    if (bv !== undefined && Number.isFinite(p.value) && Number.isFinite(bv)) { xs.push(p.value); ys.push(bv); }
  }
  if (xs.length < minPairs) return null;
  const r = pearson(xs, ys);
  if (r === null) return null;
  return {
    a: aKey, b: bKey, r, n: xs.length,
    strength: strengthOf(Math.abs(r)),
    direction: r >= 0 ? "positive" : "negative",
  };
}

/** Cari korelasi bermakna di antara semua pasangan metrik (di atas ambang, urut |r|). */
export function findCorrelations(
  series: Record<string, DailyMetricPoint[]>,
  config: Partial<CorrelationConfig> = {},
): Correlation[] {
  const cfg = { ...DEFAULT_CORRELATION_CONFIG, ...config };
  const keys = Object.keys(series);
  const out: Correlation[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const c = correlate(series[keys[i]!]!, series[keys[j]!]!, keys[i]!, keys[j]!, cfg.minPairs);
      if (c && Math.abs(c.r) >= cfg.minAbsR) out.push(c);
    }
  }
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, cfg.top);
}

/**
 * Narasi POLA deterministik (non-kausal, non-medis). `labels` memetakan key→label tampil.
 * Contoh: "Saat tidur lebih panjang, mood cenderung lebih baik (pola sedang)."
 */
export function describeCorrelation(c: Correlation, labels: Record<string, string>): string {
  const a = labels[c.a] ?? c.a;
  const b = labels[c.b] ?? c.b;
  const arah = c.direction === "positive" ? "cenderung lebih tinggi" : "cenderung lebih rendah";
  const kuat = c.strength === "strong" ? "kuat" : c.strength === "moderate" ? "sedang" : "lemah";
  return `Saat ${a} lebih tinggi, ${b} ${arah} (pola ${kuat}, ${c.n} hari).`;
}
