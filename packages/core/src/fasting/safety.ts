import type { RedFlagReason } from "../biomarker.ts";

/**
 * Keamanan medis puasa (addendum-ramadan §3.3) — sinergi Silent Killer Guard.
 *
 * ⚠️ SELURUH TEKS DI FILE INI WAJIB DIREVIEW tenaga medis + pemeriksa konten
 *    keislaman sebelum rilis (checklist §10). Teks diambil PERSIS dari spec
 *    addendum (ditulis product owner) — engine TIDAK mengarang klaim fikih/medis.
 *    Bagian deterministik hanya menentukan KAPAN pesan ditampilkan.
 *    Fitur di balik flag; teks tak menyentuh pengguna sampai review + flag nyala.
 */

/** Catatan rukhsah (§3.3 baris 3). Draft — menunggu review keislaman. */
export const RUKHSAH_NOTE =
  "Keselamatan adalah prioritas — Islam memberikan keringanan (rukhsah) berbuka bagi kondisi darurat medis. Segera tangani, lalu hubungi tenaga medis.";

/**
 * Tambahan pesan rukhsah bila KEGAWATAN GLUKOSA terjadi pada HARI PUASA
 * (hipoglikemia / krisis hiperglikemia). Null bila tidak berlaku — mis. hari
 * tidak puasa, atau kegawatan non-glukosa (krisis hipertensi ditangani jalur 119
 * umum, tanpa pesan berbuka yang spesifik glukosa).
 */
export function fastingRukhsahNote(reason: RedFlagReason | null, fasting: boolean): string | null {
  if (!fasting) return null;
  if (reason === "hipoglikemia" || reason === "hiperglikemia_berat") return RUKHSAH_NOTE;
  return null;
}

/** Interstitial pra-Ramadan untuk pemilik kondisi kronis (§3.3 baris 1). Draft — review medis. */
export const PRE_RAMADAN_MEDICAL = {
  title: "Puasa dengan kondisi Anda",
  body: "Puasa dengan kondisi Anda umumnya mungkin, namun jadwal obat dan pemantauan perlu disesuaikan — diskusikan dengan dokter sebelum Ramadan.",
  cta: "Saya paham — ingatkan konsultasi",
} as const;
