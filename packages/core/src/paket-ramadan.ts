/**
 * Paket Ramadan (Fase 9 · RW-4a) — VALIDASI MINAT sebelum monetisasi (gerbang master-roadmap §5:
 * kesediaan membayar divalidasi dulu). Berisi hipotesis tingkat paket + logika DETERMINISTIK untuk
 * memutuskan lulus/tidaknya validasi dari hitungan pilihan pengguna. MURNI (tanpa I/O) → teruji.
 * Belum ada pembayaran. Inti Mode Ramadan yang menyangkut keselamatan TETAP GRATIS.
 *
 * Harga di sini = HIPOTESIS untuk diuji, bukan hasil riset pasar. Ubah di PAKET_TIERS sebelum flag nyala.
 */

export type PaketTierId = "season" | "season_syawal" | "pro_annual";
export type PaketChoice = PaketTierId | "not_now";

export interface PaketTier {
  id: PaketTierId;
  label: string;
  priceIdr: number;
  period: string;
  desc: string;
}

export const PAKET_TIERS: PaketTier[] = [
  { id: "season", label: "Paket Ramadan", priceIdr: 29000, period: "sekali bayar · 30 hari",
    desc: "Semua fitur premium selama Ramadan." },
  { id: "season_syawal", label: "Ramadan + Syawal", priceIdr: 39000, period: "sekali bayar · ±45 hari",
    desc: "Ramadan plus 6 hari puasa Syawal." },
  { id: "pro_annual", label: "PRO Tahunan", priceIdr: 149000, period: "per tahun",
    desc: "Semua fitur premium sepanjang tahun, termasuk Paket Ramadan." },
];

/** Isi premium yang ditawarkan (hipotesis — sebagian belum dibangun; waitlist menguji minatnya). */
export const PAKET_BENEFITS: string[] = [
  "Ramadan Wrapped versi kartu gambar yang bisa dibagikan",
  "Laporan Puasa untuk dokter (PDF)",
  "Perencana menu sahur & berbuka personal",
  "Kuota ArtaBot lebih besar selama Ramadan",
];

/** Yang TIDAK pernah di-paywall (keselamatan & inti ibadah). */
export const PAKET_FREE_CORE =
  "Imsakiyah, pengingat sahur & berbuka, panduan medis puasa, dan cek konflik obat tetap gratis.";

/** Format Rupiah deterministik (tak bergantung ICU): 29000 → "Rp29.000". */
export function formatRupiah(n: number): string {
  const v = Math.max(0, Math.round(n));
  return `Rp${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export interface PaketInterestSummary {
  responses: number;                          // semua yang memilih (termasuk "belum perlu")
  interested: number;                         // memilih salah satu tingkat berbayar
  interestRatePct: number;                    // interested / activeUsers × 100 (1 desimal)
  thresholdPct: number;
  passed: boolean;                            // LULUS validasi minat
  topTier: PaketTierId | null;                // tingkat paling dipilih (seri → urutan PAKET_TIERS)
  tierCounts: Record<PaketTierId, number>;
}

/**
 * Putuskan hasil validasi minat. `counts` = jumlah pilihan per opsi (mis. dari SQL agregat),
 * `activeUsers` = pengguna aktif pada periode uji (penyebut). Lulus bila interestRatePct ≥ thresholdPct.
 */
export function paketInterestSummary(
  counts: Partial<Record<PaketChoice, number>>, activeUsers: number, thresholdPct = 10,
): PaketInterestSummary {
  const n = (v: number | undefined): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  const tierCounts = { season: n(counts.season), season_syawal: n(counts.season_syawal), pro_annual: n(counts.pro_annual) };
  const interested = tierCounts.season + tierCounts.season_syawal + tierCounts.pro_annual;
  const responses = interested + n(counts.not_now);
  const users = n(activeUsers);
  const interestRatePct = users > 0 ? Math.round((interested / users) * 1000) / 10 : 0;

  let topTier: PaketTierId | null = null;
  for (const t of PAKET_TIERS) {
    if (tierCounts[t.id] > 0 && (topTier === null || tierCounts[t.id] > tierCounts[topTier])) topTier = t.id;
  }

  return {
    responses, interested, interestRatePct, thresholdPct,
    passed: users > 0 && interestRatePct >= thresholdPct,
    topTier, tierCounts,
  };
}
