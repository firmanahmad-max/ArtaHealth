/**
 * Fokus Hari Ini (Fase 8 · KR-1) — mesin DETERMINISTIK yang menyarikan 1–3 hal paling relevan
 * dari data pengguna HARI INI untuk mendorong retensi & aktivasi core-loop. MURNI (tanpa I/O) →
 * teruji. NON-MEDIS: semua item = ajakan mencatat / motivasi, bukan saran kesehatan. Reuse data
 * pencatatan yang sudah ada; tak membuat metrik/klaim baru. Lihat docs/roadmap-fase8.md.
 */

export type FocusTone = "do" | "warn" | "celebrate";
export interface FocusItem {
  id: string;
  priority: number;   // makin tinggi makin dulu
  icon: string;
  title: string;
  tone: FocusTone;
}

export interface TodayFocusInput {
  /** Sudah dicatat HARI INI per jenis (hari lokal). */
  loggedToday: { hydration: boolean; sleep: boolean; mood: boolean; activity: boolean };
  hydrationMl: number;            // total ml diminum hari ini
  hydrationTargetMl: number;      // target harian
  currentStreak: number;          // rentetan hari berjalan (habit/log)
  streakActiveToday: boolean;     // ada aktivitas hari ini yang menjaga rentetan
  scoreReady: boolean;            // sudah ≥3 pencatatan seumur hidup (skor pertama muncul)
  totalLogsToday: number;         // jumlah pencatatan hari ini
}

const CORE_LABEL: Record<"sleep" | "hydration" | "mood" | "activity", string> = {
  sleep: "tidur", hydration: "minum", mood: "mood", activity: "aktivitas",
};

/**
 * Hasilkan hingga 3 fokus, urut prioritas turun. Deterministik. Aturan (prioritas):
 * rentetan-di-ambang-putus > aktivasi skor pertama > log inti belum > kekurangan hidrasi >
 * rayakan bila lengkap.
 */
export function todayFocus(inp: TodayFocusInput): FocusItem[] {
  const items: FocusItem[] = [];
  const L = inp.loggedToday;

  // 1. Rentetan di ambang putus (punya rentetan ≥2 tapi belum ada aktivitas hari ini)
  if (inp.currentStreak >= 2 && !inp.streakActiveToday) {
    items.push({ id: "streak", priority: 100, icon: "🔥",
      title: `Jaga rentetan ${inp.currentStreak} harimu — catat satu hal hari ini.`, tone: "warn" });
  }

  // 2. Aktivasi skor pertama (belum cukup catatan seumur hidup)
  if (!inp.scoreReady) {
    const left = Math.max(1, 3 - inp.totalLogsToday);
    items.push({ id: "first-score", priority: 90, icon: "✨",
      title: `Catat ${left} hal lagi untuk membuka skor kesehatan pertamamu.`, tone: "do" });
  }

  // 3. Log inti yang belum hari ini (satu item ringkas) — hanya setelah skor aktif
  const missing = (["sleep", "hydration", "mood", "activity"] as const).filter((k) => !L[k]);
  if (inp.scoreReady && missing.length > 0) {
    items.push({ id: "log-core", priority: 70, icon: "📝",
      title: `Belum tercatat hari ini: ${missing.map((k) => CORE_LABEL[k]).join(", ")}.`, tone: "do" });
  }

  // 4. Kekurangan hidrasi (sudah mulai minum tapi di bawah target)
  if (L.hydration && inp.hydrationTargetMl > 0 && inp.hydrationMl < inp.hydrationTargetMl) {
    const glasses = Math.round((inp.hydrationTargetMl - inp.hydrationMl) / 250);
    if (glasses >= 1) {
      items.push({ id: "hydration-gap", priority: 50, icon: "💧",
        title: `Kurang ~${glasses} gelas dari target minum hari ini.`, tone: "do" });
    }
  }

  // 5. Semua inti lengkap → rayakan (prioritas rendah, hanya bila tak ada tugas lain mendesak)
  if (inp.scoreReady && missing.length === 0) {
    items.push({ id: "all-done", priority: 10, icon: "🎉",
      title: "Catatan inti hari ini lengkap. Mantap!", tone: "celebrate" });
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
