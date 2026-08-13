import { formatTime } from "./prayer-times.ts";

/**
 * Pengingat sahur — deterministik (addendum-ramadan §6.6). Mengikuti guardrail
 * push (ui-ux §6.5): notifikasi WAJIB berisi data personal (sisa target air +
 * waktu imsak nyata), bukan alarm generik "Jangan lupa sahur!". Berbeda dari
 * buildReminder umum, pengingat ini SENGAJA aktif di jam pra-fajar (bukan jam
 * tenang) karena sahur memang sebelum subuh.
 *
 * Pengiriman (cron/Edge Function) memanggil ini dengan waktu imsak yang dihitung
 * server-side; dedup sekali-per-hari ditegakkan di lapisan pengiriman.
 */

export interface SahurReminderInput {
  /** menit sejak tengah malam lokal */
  nowMinutes: number;
  /** waktu imsak (menit sejak tengah malam) */
  imsakMinutes: number;
  /** menit sebelum imsak untuk mulai mengingatkan (default 60) */
  reminderOffsetMin: number;
  /** hidrasi hari puasa ini (opsional) — untuk saran personal */
  hydration?: { totalMl: number; targetMl: number };
}

export interface SahurReminder {
  title: string;
  body: string;
  url: string;
}

/**
 * Bangun pengingat sahur bila SEKARANG berada di jendela pra-imsak
 * [imsak − offset, imsak). Di luar jendela → null (tidak mengganggu).
 */
export function buildSahurReminder(input: SahurReminderInput): SahurReminder | null {
  const { nowMinutes, imsakMinutes, reminderOffsetMin, hydration } = input;
  const windowStart = imsakMinutes - reminderOffsetMin;
  if (nowMinutes < windowStart || nowMinutes >= imsakMinutes) return null;

  const toImsak = imsakMinutes - nowMinutes;
  let body = `Imsak ${formatTime(imsakMinutes)} — ${toImsak} menit lagi.`;

  if (hydration) {
    const sisa = hydration.targetMl - hydration.totalMl;
    body += sisa >= 250
      ? ` Sisa target air Anda ${sisa} ml — sempatkan 2 gelas + menu berprotein & berserat.`
      : " Sempatkan menu berprotein & berserat agar kuat sepanjang hari.";
  }

  return { title: "Waktu sahur 🌙", body, url: "/" };
}
