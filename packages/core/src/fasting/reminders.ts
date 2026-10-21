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

/**
 * Pengingat berbuka (iftar) — deterministik, pelengkap sahur untuk Ramadan live-ops (RW-5).
 * Mengikuti guardrail push: isi personal (waktu maghrib nyata + hitung mundur + saran hidrasi
 * bertahap), bukan alarm generik. Pengiriman (cron/Edge Function) memanggil dgn maghrib server-side;
 * dedup sekali-per-hari di lapisan pengiriman.
 */
export interface IftarReminderInput {
  /** menit sejak tengah malam lokal */
  nowMinutes: number;
  /** waktu maghrib/berbuka (menit sejak tengah malam) */
  maghribMinutes: number;
  /** menit sebelum maghrib untuk mulai mengingatkan (default 30) */
  reminderOffsetMin: number;
  /** hidrasi hari puasa ini (opsional) — untuk saran personal berbuka */
  hydration?: { totalMl: number; targetMl: number };
}

export interface IftarReminder {
  title: string;
  body: string;
  url: string;
}

/**
 * Bangun pengingat berbuka bila SEKARANG di jendela pra-maghrib [maghrib − offset, maghrib).
 * Di luar jendela → null. Pesan: hitung mundur menuju berbuka + saran hidrasi bertahap.
 */
export function buildIftarReminder(input: IftarReminderInput): IftarReminder | null {
  const { nowMinutes, maghribMinutes, reminderOffsetMin, hydration } = input;
  const windowStart = maghribMinutes - reminderOffsetMin;
  if (nowMinutes < windowStart || nowMinutes >= maghribMinutes) return null;

  const toMaghrib = maghribMinutes - nowMinutes;
  let body = `Maghrib ${formatTime(maghribMinutes)} — ${toMaghrib} menit lagi menuju berbuka.`;

  if (hydration) {
    const sisa = hydration.targetMl - hydration.totalMl;
    body += sisa >= 250
      ? ` Siapkan air & kurma; sisa target air ${sisa} ml bisa dicicil bertahap sejak berbuka.`
      : " Awali dengan air & kurma, lalu minum bertahap agar tak kembung.";
  }

  return { title: "Menjelang berbuka 🌙", body, url: "/" };
}
