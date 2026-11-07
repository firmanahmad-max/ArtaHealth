/**
 * Hak akses premium (Fase 9 · RW-4c) — engine MURNI, dipakai web DAN Edge Function `ai-gateway`
 * (impor relatif ber-ekstensi .ts → kompatibel Deno). Sumber kebenaran = tabel `subscriptions`
 * (migration 0003 + 0029): satu baris per akun, `tier` free|pro|ramadan, `valid_until`.
 * Baris ditulis HANYA oleh service_role (webhook pembayaran kelak, atau `provider='manual'`).
 *
 * PRINSIP: fitur keselamatan TIDAK PERNAH dikunci (imsakiyah, pengingat, panduan medis, konflik
 * obat — lihat PAKET_FREE_CORE). Selama sakelar paywall MATI, semua fitur premium terbuka
 * (perilaku hari ini); sakelar baru boleh dinyalakan setelah pembayaran tersedia.
 */

export type SubscriptionTier = "free" | "pro" | "ramadan";

export type PremiumFeature =
  | "wrapped_share"    // kartu gambar Ramadan Wrapped
  | "fasting_report"   // Laporan Puasa untuk dokter
  | "ramadan_menu"     // menu sahur & berbuka
  | "chat_quota_plus"; // kuota ArtaBot lebih besar

export interface SubscriptionRow { tier: string | null; valid_until: string | null }

export interface Entitlement {
  tier: SubscriptionTier;      // tier EFEKTIF (kedaluwarsa → free)
  validUntil: string | null;
  features: PremiumFeature[];
}

const RAMADAN_FEATURES: PremiumFeature[] = ["wrapped_share", "fasting_report", "ramadan_menu", "chat_quota_plus"];

export const TIER_FEATURES: Record<SubscriptionTier, PremiumFeature[]> = {
  free: [],
  ramadan: RAMADAN_FEATURES,
  pro: RAMADAN_FEATURES, // PRO tahunan mencakup Paket Ramadan (+ fitur PRO lain kelak)
};

/** Kuota chat ArtaBot per hari. null = tanpa batas. FREE sama dgn FREE_CHAT_QUOTA_PER_DAY (contracts). */
export const CHAT_QUOTA_PER_DAY: Record<SubscriptionTier, number | null> = {
  free: 5,
  ramadan: 20,
  pro: null,
};

export const FREE_ENTITLEMENT: Entitlement = { tier: "free", validUntil: null, features: [] };

const isTier = (t: unknown): t is SubscriptionTier => t === "free" || t === "pro" || t === "ramadan";

/** Hak akses efektif dari baris subscriptions (null/tak dikenal/kedaluwarsa → free). */
export function entitlementOf(row: SubscriptionRow | null | undefined, nowMs: number): Entitlement {
  if (!row || !isTier(row.tier) || row.tier === "free") return FREE_ENTITLEMENT;
  if (row.valid_until) {
    const until = Date.parse(row.valid_until);
    if (!Number.isFinite(until) || until <= nowMs) return FREE_ENTITLEMENT;
  }
  return { tier: row.tier, validUntil: row.valid_until, features: TIER_FEATURES[row.tier] };
}

/**
 * Boleh memakai fitur premium? Paywall MATI → selalu true (semua gratis, seperti sekarang).
 * Paywall NYALA → hanya bila tier efektif mencakup fitur.
 */
export function canUse(feature: PremiumFeature, ent: Entitlement, paywallOn: boolean): boolean {
  if (!paywallOn) return true;
  return ent.features.includes(feature);
}

/** Kuota chat harian untuk hak akses ini (null = tanpa batas). */
export const chatQuotaFor = (ent: Entitlement): number | null => CHAT_QUOTA_PER_DAY[ent.tier];

/** Sisa hari aktif (dibulatkan ke atas) — untuk label "aktif s/d …". null bila tanpa batas waktu/free. */
export function daysLeft(ent: Entitlement, nowMs: number): number | null {
  if (ent.tier === "free" || !ent.validUntil) return null;
  return Math.max(0, Math.ceil((Date.parse(ent.validUntil) - nowMs) / 86_400_000));
}
