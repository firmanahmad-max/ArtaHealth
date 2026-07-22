"use client";
import {
  fallbackDailyInsight, dailyInsightSchema, insightContextSchema, detectRedFlags, redFlagResponse,
  type DailyInsight, type InsightContext,
} from "@arta/core";
import { getSupabase } from "./supabase";
import { db } from "./db";
import { getActiveProfileId, LOCAL_PROFILE_ID } from "./sync";

/**
 * Client AI — SELALU lewat Edge Function `ai-gateway` (client tidak pernah
 * memegang key, CONTEXT §2). Bila gateway tidak tersedia (env kosong / offline /
 * error), UI tetap terisi memakai fallback deterministik dari core.
 */

export interface InsightResult {
  insight: DailyInsight;
  /** "ai" = dari model · "cache" = insight harian tersimpan · "fallback" = deterministik lokal */
  source: "ai" | "cache" | "fallback";
}

const insightCacheKey = (dateKey: string) => `insight:${dateKey}`;

export async function getDailyInsight(context: InsightContext, dateKey: string): Promise<InsightResult> {
  // 1) cache lokal — insight harian dibuat sekali per hari (blueprint §5.1)
  const cached = await db.meta.get(insightCacheKey(dateKey));
  if (cached) {
    const parsed = dailyInsightSchema.safeParse(JSON.parse(cached.value));
    if (parsed.success) return { insight: parsed.data, source: "cache" };
  }

  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  const canCallGateway =
    !!supabase && profileId !== LOCAL_PROFILE_ID && (typeof navigator === "undefined" || navigator.onLine);

  if (canCallGateway) {
    try {
      const { data, error } = await supabase!.functions.invoke("ai-gateway", {
        body: {
          useCase: "daily_insight",
          profileId,
          locale: "id",
          payload: { context: insightContextSchema.parse(context) },
        },
      });
      if (!error && data?.insight) {
        const parsed = dailyInsightSchema.safeParse(data.insight);
        if (parsed.success) {
          await db.meta.put({ key: insightCacheKey(dateKey), value: JSON.stringify(parsed.data) });
          return { insight: parsed.data, source: data.source === "cache" ? "cache" : "ai" };
        }
      }
    } catch {
      // jaringan/gateway bermasalah → fallback di bawah
    }
  }

  // 2) fallback deterministik — tidak di-cache supaya insight AI tetap dicoba nanti
  return { insight: fallbackDailyInsight(context), source: "fallback" };
}

export interface ChatResult {
  reply: string;
  /** true bila dihentikan Safety Guard (red flag) — UI menandai khusus */
  redFlag?: boolean;
  source: "ai" | "safety" | "fallback" | "offline" | "quota";
}

/**
 * Kirim pesan chat. Red-flag diperiksa DI CLIENT lebih dulu supaya panduan
 * darurat tetap muncul walau sedang offline atau gateway mati — keselamatan
 * tidak boleh bergantung pada jaringan (blueprint §5.3). Server memeriksa ulang.
 */
export async function sendChat(message: string, sessionId: string): Promise<ChatResult> {
  const hits = detectRedFlags(message);
  if (hits.length > 0) {
    return { reply: redFlagResponse(hits), redFlag: true, source: "safety" };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      reply: "Chat membutuhkan koneksi internet. Catatan harian Anda tetap tersimpan dan bisa dicatat seperti biasa.",
      source: "offline",
    };
  }

  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  if (!supabase || profileId === LOCAL_PROFILE_ID) {
    return {
      reply: "Chat belum tersedia — aplikasi belum tersambung ke akun Anda. Fitur pencatatan tetap berjalan normal.",
      source: "fallback",
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke("ai-gateway", {
      body: { useCase: "chat", profileId, locale: "id", payload: { message, sessionId } },
    });
    if (error) {
      // gateway mengembalikan 429 saat kuota habis, dengan pesan siap tampil
      const quotaReply = (error as { context?: { reply?: string } })?.context?.reply;
      if (quotaReply) return { reply: quotaReply, source: "quota" };
      throw error;
    }
    if (typeof data?.reply === "string") {
      return { reply: data.reply, redFlag: data.redFlag === true, source: data.source === "safety" ? "safety" : "ai" };
    }
    throw new Error("respons kosong");
  } catch {
    return {
      reply: "Maaf, saya sedang tidak bisa menjawab. Coba lagi sebentar lagi — catatan Anda tetap aman.",
      source: "fallback",
    };
  }
}
