/**
 * Ringkasan Mingguan (Fase 8 · KR-5 retensi) — refleksi KONSISTENSI mingguan (hari aktif, jumlah
 * catatan, rentetan) + kalimat motivasi DETERMINISTIK. Fokus konsistensi (bukan poin → tak dobel
 * dgn "Papan poin mingguan" di Petualangan Sehat). MURNI (tanpa I/O) → teruji. NON-MEDIS (dorongan
 * mencatat, bukan saran kesehatan). Bahan untuk kartu in-app kini & (kelak) isi push mingguan.
 */

export interface WeeklyRecapInput {
  activeDays: number;       // hari dgn ≥1 catatan minggu ini (Senin-lokal), 0..7
  totalLogs: number;        // jumlah catatan minggu ini
  prevActiveDays: number;   // hari aktif minggu lalu (untuk tren)
  currentStreak: number;    // rentetan hari berjalan
}

export interface WeeklyRecap {
  activeDays: number;
  totalLogs: number;
  streak: number;
  trend: "up" | "down" | "flat";   // hari aktif vs minggu lalu
  headline: string;                // motivasi deterministik
}

const clampDays = (n: number): number => Math.max(0, Math.min(7, Math.round(n)));

/** Rakit ringkasan mingguan dari metrik konsistensi. Deterministik & memotivasi (non-medis). */
export function weeklyRecap(input: WeeklyRecapInput): WeeklyRecap {
  const activeDays = clampDays(input.activeDays);
  const prev = clampDays(input.prevActiveDays);
  const trend: WeeklyRecap["trend"] = activeDays > prev ? "up" : activeDays < prev ? "down" : "flat";

  let headline: string;
  if (activeDays === 0) headline = "Yuk mulai catat satu hal minggu ini.";
  else if (activeDays >= 6) headline = "Minggu yang luar biasa konsisten! 🔥";
  else if (activeDays >= 4) headline = "Konsistensi yang bagus minggu ini. 👏";
  else if (activeDays >= 2) headline = "Momentum mulai terbentuk minggu ini.";
  else headline = "Awal yang baik — coba tambah satu hari lagi.";

  // Sentuhan tren (hanya bila sudah ada aktivitas) — dorongan lembut, tak menghukum.
  if (activeDays > 0) {
    if (trend === "up") headline += " Lebih aktif dari minggu lalu.";
    else if (trend === "down") headline += " Minggu lalu lebih rajin — ayo kejar.";
  }

  return {
    activeDays, totalLogs: Math.max(0, Math.round(input.totalLogs)),
    streak: Math.max(0, Math.round(input.currentStreak)), trend, headline,
  };
}
