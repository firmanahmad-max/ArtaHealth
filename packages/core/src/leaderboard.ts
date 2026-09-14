/**
 * Leaderboard (backlog · LB-1) — engine DETERMINISTIK: ranking generik + bucket poin per minggu
 * untuk papan PRIBADI-temporal (minggu ini vs minggu-minggu lalumu). MURNI (tanpa I/O) → teruji.
 * Poin diturunkan dari Gamification (XP_RULES); TAK memakai nilai kesehatan sebagai skor. Papan
 * SOSIAL (bandingkan dgn orang lain) = LB-3 di balik gerbang privasi. Lihat docs/addendum-leaderboard.md.
 */

// ===== Ranking generik =====

export interface RankedEntry<T> {
  entry: T;
  score: number;
  rank: number;       // peringkat kompetisi standar (1,2,2,4) — seri berbagi peringkat
  percentile: number; // 0..100, makin tinggi makin baik (100 = teratas)
}

/**
 * Peringkatkan entri berdasarkan skor (turun). Seri → peringkat sama (competition ranking).
 * `tieBreak` (opsional) menstabilkan urutan antar-seri secara deterministik (mis. label/tanggal).
 */
export function rankEntries<T>(
  entries: T[], scoreOf: (e: T) => number, tieBreak?: (e: T) => string,
): RankedEntry<T>[] {
  const scored = entries.map((entry) => ({ entry, score: scoreOf(entry) }));
  scored.sort((a, b) => b.score - a.score || (tieBreak ? tieBreak(a.entry).localeCompare(tieBreak(b.entry)) : 0));
  const n = scored.length;
  const out: RankedEntry<T>[] = [];
  for (let i = 0; i < n; i++) {
    // peringkat = 1 + jumlah entri dengan skor lebih tinggi (seri berbagi)
    const rank = i > 0 && scored[i]!.score === scored[i - 1]!.score ? out[i - 1]!.rank : i + 1;
    const percentile = n <= 1 ? 100 : Math.round(((n - rank) / (n - 1)) * 100);
    out.push({ entry: scored[i]!.entry, score: scored[i]!.score, rank, percentile });
  }
  return out;
}

// ===== Minggu lokal (Senin) =====

/** Awal minggu (Senin 00:00 lokal) untuk sebuah tanggal. */
export function weekStartLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Sen=0 … Min=6
  x.setDate(x.getDate() - dow);
  return x;
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Kunci minggu (tanggal Senin lokal, "YYYY-MM-DD") dari ISO timestamp. */
export function weekKeyLocal(iso: string): string {
  return ymd(weekStartLocal(new Date(iso)));
}

// ===== Bucket poin mingguan =====

export interface PointEvent { at: string; points: number }  // at = ISO; points = XP turunan
export interface WeekPoints { weekKey: string; weekStartISO: string; points: number; events: number }

/**
 * Total poin per minggu untuk `weeks` minggu terakhir (termasuk minggu bernilai 0), urut lama→baru.
 * Minggu ditentukan dari Senin lokal — konsisten lintas timezone runner.
 */
export function weeklyPoints(events: PointEvent[], nowMs: number, weeks = 8): WeekPoints[] {
  const thisMonday = weekStartLocal(new Date(nowMs));
  const buckets: WeekPoints[] = [];
  const index = new Map<string, number>();
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(thisMonday);
    ws.setDate(ws.getDate() - i * 7);
    const key = ymd(ws);
    index.set(key, buckets.length);
    buckets.push({ weekKey: key, weekStartISO: ws.toISOString(), points: 0, events: 0 });
  }
  for (const e of events) {
    if (!Number.isFinite(e.points)) continue;
    const key = weekKeyLocal(e.at);
    const at = index.get(key);
    if (at == null) continue; // di luar jendela
    buckets[at]!.points += e.points;
    buckets[at]!.events += 1;
  }
  return buckets;
}

/** Minggu dengan poin tertinggi (rekor pribadi). null bila kosong; seri → minggu paling awal. */
export function personalBestWeek(weeks: WeekPoints[]): WeekPoints | null {
  let best: WeekPoints | null = null;
  for (const w of weeks) if (!best || w.points > best.points) best = w;
  return best;
}

export interface WeekMomentum {
  current: WeekPoints | null;
  previous: WeekPoints | null;
  delta: number;                          // current - previous
  direction: "up" | "down" | "flat";
  rankAmongWeeks: number | null;          // peringkat minggu berjalan di antara minggu tercatat
  isPersonalBest: boolean;
}

/** Momentum minggu berjalan: delta vs minggu lalu + peringkat di antara minggu-minggumu sendiri. */
export function weekMomentum(weeks: WeekPoints[]): WeekMomentum {
  const current = weeks.length ? weeks[weeks.length - 1]! : null;
  const previous = weeks.length >= 2 ? weeks[weeks.length - 2]! : null;
  const delta = (current?.points ?? 0) - (previous?.points ?? 0);
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  // peringkat hanya di antara minggu yang PUNYA aktivitas (hindari "peringkat 1 dari nol")
  const active = weeks.filter((w) => w.events > 0);
  const ranked = rankEntries(active, (w) => w.points, (w) => w.weekKey);
  const rankAmongWeeks = current ? ranked.find((r) => r.entry.weekKey === current.weekKey)?.rank ?? null : null;
  const best = personalBestWeek(active);
  const isPersonalBest = !!current && !!best && current.events > 0 && current.weekKey === best.weekKey && current.points > 0;
  return { current, previous, delta, direction, rankAmongWeeks, isPersonalBest };
}
