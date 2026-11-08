/**
 * "Apa Baru" — pelacakan PER ENTRI (Fase 8 · KR-4, revisi Nov 2026). DETERMINISTIK.
 *
 * Versi lama memakai satu VERSION global: menambah entri baru berarti bump versi → SEMUA entri
 * lama ikut muncul lagi. Kini tiap entri punya `id` + `since` (YYYY-MM):
 * - yang sudah pernah ditutup ("Mengerti") tak muncul lagi;
 * - entri kedaluwarsa setelah `maxAgeMonths` → pengguna baru tak disuguhi berita lama;
 * - nilai lama localStorage (string versi, mis. "2026-09") dimigrasi: entri dengan since ≤ versi itu
 *   dianggap sudah dilihat.
 */

export interface WhatsNewItem {
  id: string;
  /** bulan rilis "YYYY-MM" */
  since: string;
}

export const WHATS_NEW_MAX_AGE_MONTHS = 3;

const monthIndex = (ym: string): number => {
  const [y, m] = ym.split("-").map(Number);
  return (y ?? 0) * 12 + ((m ?? 1) - 1);
};

/** Baca nilai localStorage (array id JSON, atau string versi lama) → kumpulan id yang sudah dilihat. */
export function parseWhatsNewSeen(raw: string | null, items: readonly WhatsNewItem[]): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch { /* bukan JSON → mungkin format versi lama */ }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return new Set(items.filter((i) => monthIndex(i.since) <= monthIndex(raw)).map((i) => i.id));
  }
  return new Set();
}

/** Entri yang perlu ditampilkan: belum dilihat & belum kedaluwarsa (urutan masukan dipertahankan). */
export function pendingWhatsNew<T extends WhatsNewItem>(
  items: readonly T[], seen: ReadonlySet<string>, todayKey: string,
  maxAgeMonths = WHATS_NEW_MAX_AGE_MONTHS,
): T[] {
  const now = monthIndex(todayKey.slice(0, 7));
  return items.filter((i) => !seen.has(i.id) && now - monthIndex(i.since) < maxAgeMonths);
}

/** Nilai localStorage baru setelah "Mengerti": gabungan yang sudah dilihat + yang baru ditutup. */
export function serializeWhatsNewSeen(seen: ReadonlySet<string>, dismissedIds: readonly string[]): string {
  return JSON.stringify([...new Set([...seen, ...dismissedIds])].sort());
}
