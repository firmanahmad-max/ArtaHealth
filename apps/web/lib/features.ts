/**
 * Feature flags build-time (Fase 2+). Default OFF: fitur biomarker TIDAK tampil
 * ke pengguna sampai env di-set — jaminan paling kuat bahwa ambang klinis yang
 * belum direview dokter (addendum §5, CONTEXT §4) tak bocor ke produksi.
 *
 * Dev/staging: set NEXT_PUBLIC_FEATURE_BIOMARKER=1 di .env.local.
 * Produksi (Vercel): biarkan kosong sampai review medis selesai.
 */
export const featureBiomarker = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_BIOMARKER === "1";

/**
 * V2 biomarker (lipid & asam urat) — flag TERPISAH. Ambang V2 butuh review dokter
 * tersendiri, jadi kodenya boleh masuk produksi (di-merge) tanpa tampil sampai
 * flag ini di-set. V2 adalah perluasan V1: mensyaratkan featureBiomarker() juga aktif.
 */
export const featureBiomarkerV2 = (): boolean =>
  featureBiomarker() && process.env.NEXT_PUBLIC_FEATURE_BIOMARKER_V2 === "1";

/**
 * Mode Ramadan (Fase 3). Default OFF: fitur puasa tak tampil sampai akurasi
 * imsakiyah divalidasi vs Kemenag (±2 mnt) & konten medis/keislaman direview
 * (addendum-ramadan §10). Dev: set NEXT_PUBLIC_FEATURE_RAMADAN=1 di .env.local.
 */
export const featureRamadan = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_RAMADAN === "1";

/**
 * Modul obat / Medicine Reminder (Fase 3). Default OFF. Flag sendiri karena modul
 * terpisah; deteksi konflik jadwal obat vs jam puasa aktif hanya bila Mode Ramadan
 * juga menyala. Dev: set NEXT_PUBLIC_FEATURE_MEDICATION=1 di .env.local.
 */
export const featureMedication = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_MEDICATION === "1";
