import type { ReminderKind } from "./notifications.ts";

/**
 * Preferensi jenis pengingat (Fase 8 · tindak lanjut retensi) — DETERMINISTIK & Deno-kompatibel
 * (dipakai web + Edge Function `send-reminders`).
 *
 * Pengguna memilih KATEGORI mana yang dibisukan; server menerjemahkannya ke `kind` push. Default =
 * tak ada yang dibisukan (perilaku sama dengan sebelum fitur ini). Membisukan satu kategori tidak
 * menyentuh izin notifikasi browser — kategori lain tetap jalan.
 */

/** Semua jenis push yang dikirim `send-reminders` (= nilai `reminder_log.kind`). */
export type PushKind = ReminderKind | "sahur" | "iftar" | "weekly";

export type NotificationCategory = "hydration" | "habit" | "sleep" | "weekly" | "ramadan";

export interface NotificationCategoryInfo {
  id: NotificationCategory;
  label: string;
  hint: string;
  kinds: PushKind[];
  /** hanya relevan saat Mode Ramadan aktif (UI menyembunyikannya bila fitur mati) */
  seasonal?: boolean;
}

export const NOTIFICATION_CATEGORIES: NotificationCategoryInfo[] = [
  { id: "hydration", label: "Minum air", hint: "Sore hari, bila target minum masih jauh", kinds: ["hydration"] },
  { id: "habit", label: "Kebiasaan & langkah", hint: "Menjelang malam, termasuk pesan rentetan", kinds: ["habit"] },
  { id: "sleep", label: "Tidur", hint: "Malam hari, bila tidur semalam kurang", kinds: ["sleep"] },
  { id: "weekly", label: "Ringkasan mingguan", hint: "Minggu malam, sekali seminggu", kinds: ["weekly"] },
  { id: "ramadan", label: "Sahur & berbuka", hint: "Hanya di hari puasa", kinds: ["sahur", "iftar"], seasonal: true },
];

const VALID = new Set<string>(NOTIFICATION_CATEGORIES.map((c) => c.id));

/** Bersihkan masukan apa pun (kolom DB, meta lokal) → daftar kategori valid, unik, urut baku. */
export function normalizeMuted(input: unknown): NotificationCategory[] {
  if (!Array.isArray(input)) return [];
  const set = new Set(input.filter((v): v is string => typeof v === "string" && VALID.has(v)));
  return NOTIFICATION_CATEGORIES.map((c) => c.id).filter((id) => set.has(id));
}

/** Kategori dibisukan → daftar `kind` push yang tidak boleh dikirim. */
export function mutedKinds(muted: readonly NotificationCategory[]): PushKind[] {
  const set = new Set(muted);
  return NOTIFICATION_CATEGORIES.filter((c) => set.has(c.id)).flatMap((c) => c.kinds);
}

export function isKindMuted(kind: PushKind, muted: readonly NotificationCategory[]): boolean {
  return mutedKinds(muted).includes(kind);
}

/** Nyalakan/matikan satu kategori, hasil tetap ternormalisasi. */
export function toggleMuted(
  muted: readonly NotificationCategory[], id: NotificationCategory, mute: boolean,
): NotificationCategory[] {
  const next = new Set(muted);
  if (mute) next.add(id); else next.delete(id);
  return normalizeMuted([...next]);
}
