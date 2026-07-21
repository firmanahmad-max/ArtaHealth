import { z } from "zod";

/**
 * Kontrak AI Gateway (technical-blueprint §5.1–5.2).
 * Aturan keras: output AI SELALU JSON tervalidasi Zod. Gagal validasi →
 * retry 1× → fallback template deterministik (UI tidak pernah kosong).
 */

export const AI_USE_CASES = ["daily_insight", "chat"] as const; // V1; food/ocr/correlation menyusul fase berikutnya
export const useCaseSchema = z.enum(AI_USE_CASES);
export type AiUseCase = z.infer<typeof useCaseSchema>;

export const aiRequestSchema = z.object({
  useCase: useCaseSchema,
  profileId: z.string().uuid(),
  payload: z.record(z.unknown()).default({}),
  locale: z.enum(["id", "en"]).default("id"),
});
export type AiRequest = z.infer<typeof aiRequestSchema>;

/** Konteks ringkas (bukan raw rows) — hemat token, blueprint §5.2. */
export const insightContextSchema = z.object({
  date: z.string(),
  sleep: z.object({ durationMin: z.number(), vsAvg7d: z.string().optional(), consistency: z.string().optional() }).optional(),
  hydration: z.object({ totalMl: z.number(), targetMl: z.number(), pct: z.number() }).optional(),
  activity: z.object({ steps: z.number().optional(), target: z.number(), exerciseMin: z.number().optional() }).optional(),
  mood: z.number().min(1).max(5).optional(),
  habits: z.object({ completed: z.number(), total: z.number() }).optional(),
  score: z.object({
    today: z.number(),
    yesterday: z.number().optional(),
    deltaReason: z.array(z.string()).default([]),
  }),
});
export type InsightContext = z.infer<typeof insightContextSchema>;

export const FOCUS_AREAS = ["sleep", "hydration", "activity", "mood", "habit"] as const;

/** Output Daily Insight — persis kontrak blueprint §5.2. */
export const dailyInsightSchema = z.object({
  summary: z.string().min(1).max(400),
  targets: z.array(z.string().min(1).max(80)).min(1).max(4),
  motivation: z.string().min(1).max(200),
  focusArea: z.enum(FOCUS_AREAS),
});
export type DailyInsight = z.infer<typeof dailyInsightSchema>;

export const chatReplySchema = z.object({
  reply: z.string().min(1).max(2000),
  /** ditandai true bila jawaban menyinggung kondisi tubuh → UI menampilkan disclaimer */
  needsDisclaimer: z.boolean().default(true),
});
export type ChatReply = z.infer<typeof chatReplySchema>;

/** Kuota free tier (blueprint §5.1). */
export const FREE_CHAT_QUOTA_PER_DAY = 5;
