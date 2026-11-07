/**
 * Ramadan Wrapped — kartu gambar yang bisa dibagikan (Fase 9 · RW-4 manfaat premium #1). Engine
 * MURNI: dari hasil `ramadanWrapped` → isi kartu (judul, angka utama, stat, headline, caption).
 *
 * PRIVASI-DULU: kartu dibagikan ke publik, sedangkan hari tak berpuasa bisa karena haid/sakit/safar
 * → jumlah qadha TIDAK PERNAH ikut; persentase & total hari (yang menyiratkan hari terlewat) hanya
 * bila pengguna memilih `showCompletion`. Headline publik selalu positif (tanpa nada "kurang").
 */

import type { RamadanWrapped, RamadanTier } from "./ramadan-wrapped.ts";
import { gregorianToHijri } from "./hijri.ts";

export interface WrappedShareOptions {
  startDate: string;         // "YYYY-MM-DD" awal Ramadan (untuk tahun Hijriah)
  inProgress: boolean;       // Ramadan masih berjalan → label "sejauh ini"
  showCompletion?: boolean;  // tampilkan % & total hari (default false)
}

export interface WrappedShareStat { value: string; label: string }

export interface WrappedShareCard {
  title: string;             // "Ramadan 1448 H"
  subtitle: string;          // "Rekap puasaku" / "Rekap puasaku sejauh ini"
  heroValue: string;         // angka besar
  heroLabel: string;
  stats: WrappedShareStat[];
  headline: string;
  caption: string;           // teks pendamping saat dibagikan
}

const SHARE_HEADLINE: Record<RamadanTier, string> = {
  penuh: "Sebulan penuh — Alhamdulillah. 🌙",
  kuat: "Konsisten sepanjang Ramadan. Alhamdulillah. ✨",
  baik: "Setiap hari puasa berarti. Alhamdulillah.",
  mulai: "Setiap hari puasa berarti. Alhamdulillah.",
};

export function hijriYearOf(dateKey: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  return gregorianToHijri(Number(m[1]), Number(m[2]), Number(m[3])).year;
}

/** null bila belum ada hari berpuasa (tak ada yang layak dibagikan). */
export function wrappedShareCard(w: RamadanWrapped, opts: WrappedShareOptions): WrappedShareCard | null {
  if (w.totalDays === 0 || w.fastedDays === 0) return null;
  const hy = hijriYearOf(opts.startDate);
  const title = hy ? `Ramadan ${hy} H` : "Ramadan";
  const subtitle = opts.inProgress ? "Rekap puasaku sejauh ini" : "Rekap puasaku";

  const stats: WrappedShareStat[] = [];
  if (w.longestStreak > 1) stats.push({ value: `${w.longestStreak} hari`, label: "rentetan terpanjang" });
  if (opts.showCompletion) stats.push({ value: `${w.completionPct}%`, label: `dari ${w.totalDays} hari` });

  const headline = opts.inProgress && w.tier === "penuh"
    ? "Belum terputus sejauh ini — semoga istiqamah. 🌙"
    : SHARE_HEADLINE[w.tier];

  const caption = `${title}: ${w.fastedDays} hari berpuasa${opts.inProgress ? " sejauh ini" : ""}. Alhamdulillah 🌙 — dicatat dengan ArtaHealth`;

  return { title, subtitle, heroValue: String(w.fastedDays), heroLabel: "hari berpuasa", stats, headline, caption };
}
