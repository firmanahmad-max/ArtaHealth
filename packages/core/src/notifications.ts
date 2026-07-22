import type { InsightContext } from "./ai/contracts.ts";

/**
 * Mesin keputusan pengingat — deterministik (CONTEXT §3).
 *
 * Aturan produk yang ditegakkan di sini (ui-ux-spec §6 poin 5, CONTEXT §4):
 * - Push WAJIB memuat data personal (angka nyata milik user). Tidak ada
 *   "Jangan lupa buka aplikasi!" — bila tidak ada yang personal untuk
 *   dikatakan, fungsi mengembalikan null dan notifikasi TIDAK dikirim.
 * - Tidak menghakimi: kalimat mengarah ke sisa langkah, bukan kegagalan.
 * - Tidak mengganggu jam istirahat.
 */

export type ReminderKind = "hydration" | "habit" | "sleep";

export interface Reminder {
  kind: ReminderKind;
  title: string;
  body: string;
  /** dipakai client untuk membuka layar yang relevan */
  url: string;
}

export interface ReminderOptions {
  /** jam lokal user 0–23 */
  hour: number;
  /** kategori yang sudah dikirim hari ini — tidak diulang */
  alreadySentToday?: ReminderKind[];
  /** jam mulai istirahat (default 22) */
  quietFromHour?: number;
  /** jam selesai istirahat (default 7) */
  quietUntilHour?: number;
}

const idNum = (n: number) => n.toLocaleString("id-ID");
const liters = (ml: number) => (ml / 1000).toFixed(1).replace(".", ",");

function inQuietHours(hour: number, from: number, until: number): boolean {
  return from > until ? hour >= from || hour < until : hour >= from && hour < until;
}

/**
 * Mengembalikan SATU pengingat paling relevan, atau null bila tidak ada yang
 * layak dikirim. Sengaja satu: beberapa notifikasi sehari adalah gangguan.
 */
export function buildReminder(ctx: InsightContext, opts: ReminderOptions): Reminder | null {
  const { hour, alreadySentToday = [], quietFromHour = 22, quietUntilHour = 7 } = opts;
  if (inQuietHours(hour, quietFromHour, quietUntilHour)) return null;

  const sent = new Set(alreadySentToday);

  // 1) Hidrasi — paling actionable, dikirim sore saat masih sempat dikejar
  if (!sent.has("hydration") && ctx.hydration && hour >= 14 && hour < 19) {
    const sisa = ctx.hydration.targetMl - ctx.hydration.totalMl;
    // target tercapai → tidak ada alasan mengganggu
    if (sisa >= 250) {
      return {
        kind: "hydration",
        title: "Tinggal sedikit lagi 💧",
        body: `Kurang ${liters(sisa)} liter menuju target air Anda hari ini (${liters(ctx.hydration.totalMl)} dari ${liters(ctx.hydration.targetMl)} liter).`,
        url: "/",
      };
    }
  }

  // 2) Kebiasaan — menjelang malam, saat masih bisa diselesaikan
  if (!sent.has("habit") && ctx.habits && hour >= 18 && hour < quietFromHour) {
    const sisa = ctx.habits.total - ctx.habits.completed;
    if (sisa > 0) {
      return {
        kind: "habit",
        title: sisa === 1 ? "Tinggal satu kebiasaan" : `Tinggal ${sisa} kebiasaan`,
        body: `${ctx.habits.completed} dari ${ctx.habits.total} kebiasaan hari ini sudah selesai. Masih ada waktu.`,
        url: "/",
      };
    }
  }

  // 3) Langkah — sore, hanya bila masih realistis dikejar
  if (!sent.has("habit") && ctx.activity?.steps !== undefined && hour >= 16 && hour < 19) {
    const sisa = ctx.activity.target - ctx.activity.steps;
    if (sisa >= 1000 && sisa <= 4000) {
      return {
        kind: "habit",
        title: "Sedikit lagi menuju target langkah",
        body: `Kurang ${idNum(sisa)} langkah dari target ${idNum(ctx.activity.target)}. Jalan 15 menit biasanya cukup.`,
        url: "/",
      };
    }
  }

  // 4) Tidur — hanya bila tidur semalam memang kurang, jadi pesannya beralasan
  if (!sent.has("sleep") && ctx.sleep && hour >= 20 && hour < quietFromHour) {
    if (ctx.sleep.durationMin < 420) {
      const kurang = 420 - ctx.sleep.durationMin;
      return {
        kind: "sleep",
        title: "Waktunya bersiap istirahat 🌙",
        body: `Tidur Anda semalam ${Math.floor(ctx.sleep.durationMin / 60)}j ${ctx.sleep.durationMin % 60}m — ${kurang} menit di bawah rentang ideal. Tidur lebih awal malam ini?`,
        url: "/",
      };
    }
  }

  // Tidak ada yang personal untuk disampaikan → jangan kirim apa pun.
  return null;
}
