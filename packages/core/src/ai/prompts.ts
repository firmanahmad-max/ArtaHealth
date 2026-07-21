import type { AiUseCase, InsightContext } from "./contracts.ts";

/**
 * Prompt Registry ber-versi (blueprint §5.1 poin 3) — prompt TIDAK hardcoded
 * di call-site. Menaikkan versi = perubahan tercatat & bisa dibandingkan.
 * Setiap system prompt memuat pagar keselamatan (§5.3); Safety Guard tetap
 * dijalankan terpisah karena kepatuhan model tidak boleh diandalkan.
 */

export interface PromptTemplate {
  version: string;
  system: string;
  buildUser: (context: unknown) => string;
}

const SAFETY_PREAMBLE = [
  "Anda adalah Arta, teman kesehatan harian berbahasa Indonesia.",
  "ATURAN KERAS:",
  "- Hanya edukasi umum & gaya hidup. DILARANG mendiagnosis.",
  "- DILARANG menyebut dosis obat, menyarankan memulai/menghentikan obat.",
  "- Untuk gejala atau kondisi medis, arahkan konsultasi ke dokter.",
  "- Nada hangat, spesifik, tidak menghakimi, tidak menggurui, tidak klinis.",
  "- Sebut angka dari data yang diberikan, jangan mengarang data.",
  "- Maksimal 1 emoji. Jangan pakai emoji pada konten medis.",
  "- Balas HANYA JSON valid sesuai skema. Tanpa teks di luar JSON.",
].join("\n");

const dailyInsightV1: PromptTemplate = {
  version: "daily_insight@1",
  system: [
    SAFETY_PREAMBLE,
    "",
    "Tugas: tulis insight harian dari data kesehatan pengguna.",
    'Skema JSON: {"summary": string, "targets": string[1..4], "motivation": string, "focusArea": "sleep"|"hydration"|"activity"|"mood"|"habit"}',
    "- summary: 1-2 kalimat, sebutkan perubahan konkret vs kemarin/rata-rata.",
    "- targets: aksi hari ini yang bisa langsung dikerjakan (mis. 'Minum 2,5 liter air').",
    "- motivation: 1 kalimat penyemangat yang spesifik, bukan pujian kosong.",
    "- focusArea: satu area paling layak diperbaiki hari ini.",
  ].join("\n"),
  buildUser: (context) => JSON.stringify(context),
};

const chatV1: PromptTemplate = {
  version: "chat@1",
  system: [
    SAFETY_PREAMBLE,
    "",
    "Tugas: jawab pertanyaan pengguna tentang kebiasaan sehat sehari-hari.",
    'Skema JSON: {"reply": string, "needsDisclaimer": boolean}',
    "- reply: ringkas (maksimal ~120 kata), langsung menjawab, pakai data pengguna bila relevan.",
    "- needsDisclaimer: true bila jawaban menyinggung kondisi tubuh/kesehatan.",
    "- Bila pertanyaan di luar kesehatan harian, katakan dengan ramah bahwa itu di luar cakupan Anda.",
  ].join("\n"),
  buildUser: (context) => JSON.stringify(context),
};

export const PROMPT_REGISTRY: Record<AiUseCase, PromptTemplate> = {
  daily_insight: dailyInsightV1,
  chat: chatV1,
};

export const getPrompt = (useCase: AiUseCase): PromptTemplate => PROMPT_REGISTRY[useCase];

// ===== Fallback deterministik =====
// Dipakai saat AI gagal/timeout/validasi gagal 2×. UI tidak pernah kosong (§5.2).

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function fallbackDailyInsight(ctx: InsightContext) {
  const targets: string[] = [];
  let focusArea: "sleep" | "hydration" | "activity" | "mood" | "habit" = "habit";
  let worst = 101;

  if (ctx.hydration) {
    const p = ctx.hydration.pct || pct(ctx.hydration.totalMl, ctx.hydration.targetMl);
    const sisa = Math.max(0, ctx.hydration.targetMl - ctx.hydration.totalMl);
    if (sisa > 0) targets.push(`Minum ${(sisa / 1000).toFixed(1)} liter air lagi`);
    if (p < worst) { worst = p; focusArea = "hydration"; }
  }
  if (ctx.activity) {
    const steps = ctx.activity.steps ?? 0;
    const p = pct(steps, ctx.activity.target);
    if (steps < ctx.activity.target) {
      targets.push(`Lengkapi ${(ctx.activity.target - steps).toLocaleString("id-ID")} langkah lagi`);
    }
    if (p < worst) { worst = p; focusArea = "activity"; }
  }
  if (ctx.sleep) {
    const p = pct(ctx.sleep.durationMin, 480);
    if (ctx.sleep.durationMin < 420) targets.push("Tidur 30 menit lebih awal malam ini");
    if (p < worst) { worst = p; focusArea = "sleep"; }
  }
  if (ctx.habits && ctx.habits.total > 0) {
    const p = pct(ctx.habits.completed, ctx.habits.total);
    const sisa = ctx.habits.total - ctx.habits.completed;
    if (sisa > 0) targets.push(`Selesaikan ${sisa} kebiasaan yang tersisa`);
    if (p < worst) { worst = p; focusArea = "habit"; }
  }
  if (targets.length === 0) targets.push("Pertahankan ritme hari ini");

  const delta = ctx.score.yesterday !== undefined ? ctx.score.today - ctx.score.yesterday : undefined;
  const summary =
    delta === undefined
      ? `Health Score Anda hari ini ${ctx.score.today}.`
      : delta > 0
        ? `Health Score Anda ${ctx.score.today}, naik ${delta} poin dari kemarin.`
        : delta < 0
          ? `Health Score Anda ${ctx.score.today}, turun ${Math.abs(delta)} poin dari kemarin.`
          : `Health Score Anda ${ctx.score.today}, sama seperti kemarin.`;

  return {
    summary,
    targets: targets.slice(0, 4),
    motivation: "Satu langkah kecil hari ini tetap lebih berarti daripada rencana besar yang ditunda.",
    focusArea,
  };
}

export const FALLBACK_CHAT_REPLY =
  "Maaf, saya sedang tidak bisa memproses pertanyaan itu sekarang. Coba lagi sebentar lagi — sementara itu, catatan harian Anda tetap tersimpan dan Health Score tetap terhitung.";
