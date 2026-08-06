// ArtaHealth · Edge Function `ai-gateway`
// SATU-SATUNYA pintu ke provider AI (technical-blueprint §5.1). Client tidak
// pernah memegang API key. Urutan tanggung jawab per request:
//   auth → kuota (tier) → Safety Guard input → prompt registry → provider
//   → validasi Zod (retry 1×) → Safety Guard output → cache/simpan
// Gagal di mana pun setelah safety → fallback template deterministik (§5.2):
// UI tidak pernah kosong karena AI down.
//
// Provider: Sumopod (produksi). Dev bisa diarahkan ke LiteLLM lokal via env
// AI_GATEWAY_PROVIDER=litellm + LITELLM_BASE_URL (lihat .env.example).
// Deploy: supabase functions deploy ai-gateway

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  aiRequestSchema, dailyInsightSchema, chatReplySchema, insightContextSchema,
  FREE_CHAT_QUOTA_PER_DAY, type DailyInsight,
} from "../../../packages/core/src/ai/contracts.ts";
import {
  detectRedFlags, redFlagResponse, isUnsafeOutput, SAFE_OUTPUT_FALLBACK,
} from "../../../packages/core/src/ai/safety.ts";
import { getPrompt, fallbackDailyInsight, FALLBACK_CHAT_REPLY } from "../../../packages/core/src/ai/prompts.ts";
import { localDateKey } from "../../../packages/core/src/timezone.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  // supabase-js mengirim apikey & x-client-info juga — tanpa ini browser memblokir
  // request (preflight gagal → blank/no-CORS). curl mengabaikan CORS, makanya lolos.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

interface ProviderConfig { baseUrl: string; apiKey: string; model: string }

function providerConfig(): ProviderConfig {
  const provider = Deno.env.get("AI_GATEWAY_PROVIDER") ?? "sumopod";
  if (provider === "litellm") {
    return {
      baseUrl: Deno.env.get("LITELLM_BASE_URL") ?? "http://localhost:4000",
      apiKey: Deno.env.get("LITELLM_API_KEY") ?? "dev",
      model: Deno.env.get("AI_MODEL") ?? "gpt-4o-mini",
    };
  }
  return {
    baseUrl: Deno.env.get("SUMOPOD_BASE_URL") ?? "",
    apiKey: Deno.env.get("SUMOPOD_API_KEY") ?? "",
    model: Deno.env.get("AI_MODEL") ?? "gpt-4o-mini",
  };
}

/** Panggilan chat-completions (format OpenAI-compatible) + timeout keras. */
async function callProvider(system: string, user: string): Promise<{ content: string; tokens: number }> {
  const cfg = providerConfig();
  if (!cfg.baseUrl || !cfg.apiKey) throw new Error("provider belum dikonfigurasi");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`provider ${res.status}`);
    const body = await res.json();
    return {
      content: body?.choices?.[0]?.message?.content ?? "",
      tokens: body?.usage?.total_tokens ?? 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Ambil JSON dari respons model (model kadang membungkus dengan ```json). */
function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(trimmed);
}

/** Panggil + validasi; gagal → retry sekali. Null bila tetap gagal. */
async function callValidated<T>(
  system: string, user: string, validate: (v: unknown) => T | null,
): Promise<{ value: T; tokens: number } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { content, tokens } = await callProvider(system, user);
      const parsed = validate(parseJsonLoose(content));
      if (parsed !== null) return { value: parsed, tokens };
    } catch {
      // jaringan/timeout/JSON rusak → percobaan berikutnya, lalu fallback
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method tidak didukung" }, 405);

  try {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  // Platform Supabase sudah verify_jwt SEBELUM fungsi ini jalan → tanda tangan token
  // sudah tervalidasi, payload tepercaya. Ambil user id dari klaim `sub` via decode
  // lokal (hemat 1 round-trip ke GoTrue vs getUser). Kepemilikan dicek via account_id.
  let userId: string | null = null;
  try {
    const part = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    userId = JSON.parse(atob(padded)).sub ?? null;
  } catch { userId = null; }
  if (!userId) return json({ error: "unauthorized" }, 401);

  const parsedReq = aiRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedReq.success) return json({ error: "request tidak valid" }, 400);
  const { useCase, profileId, payload, locale } = parsedReq.data;

  // profil WAJIB milik akun ini (service role bypass RLS → cek account_id manual)
  const { data: profile } = await db
    .from("profiles").select("id, timezone, account_id").eq("id", profileId).maybeSingle();
  if (!profile || profile.account_id !== userId) return json({ error: "profil tidak ditemukan" }, 404);

  const tz = profile.timezone || "Asia/Jakarta";
  const todayKey = localDateKey(new Date(), tz);
  const prompt = getPrompt(useCase);

  // ===== CHAT =====
  if (useCase === "chat") {
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message) return json({ error: "pesan kosong" }, 400);

    // 1) Safety Guard input — SEBELUM model & sebelum kuota dipotong
    const hits = detectRedFlags(message);
    if (hits.length > 0) {
      // audit tanpa isi pesan (§5.3): hanya kategori & label pola
      console.warn(`red_flag profile=${profileId} categories=${hits.map((h) => h.category).join(",")}`);
      return json({ reply: redFlagResponse(hits), redFlag: true, needsDisclaimer: true, source: "safety" });
    }

    // 2) Kuota harian free tier
    const { data: sub } = await db
      .from("subscriptions").select("tier, valid_until").eq("account_id", userId).maybeSingle();
    const isPro = sub?.tier === "pro" && (!sub.valid_until || new Date(sub.valid_until) > new Date());
    if (!isPro) {
      const { count } = await db
        .from("ai_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId).eq("role", "user")
        .gte("created_at", `${todayKey}T00:00:00Z`);
      if ((count ?? 0) >= FREE_CHAT_QUOTA_PER_DAY) {
        return json({
          error: "quota_exceeded",
          reply: `Kuota chat gratis hari ini sudah habis (${FREE_CHAT_QUOTA_PER_DAY} pesan). Kuota berikutnya tersedia besok.`,
        }, 429);
      }
    }

    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : crypto.randomUUID();
    await db.from("ai_chat_messages").insert({
      profile_id: profileId, session_id: sessionId, role: "user", content: message,
    });

    const result = await callValidated(
      prompt.system,
      prompt.buildUser({ message, locale, context: payload.context ?? null }),
      (v) => { const r = chatReplySchema.safeParse(v); return r.success ? r.data : null; },
    );

    // 3) Safety Guard output
    let reply = result?.value.reply ?? FALLBACK_CHAT_REPLY;
    let source = result ? "ai" : "fallback";
    if (result && isUnsafeOutput(reply)) {
      console.warn(`unsafe_output_blocked profile=${profileId} useCase=chat`);
      reply = SAFE_OUTPUT_FALLBACK;
      source = "safety";
    }

    await db.from("ai_chat_messages").insert({
      profile_id: profileId, session_id: sessionId, role: "assistant",
      content: reply, token_count: result?.tokens ?? null,
    });
    return json({ reply, sessionId, needsDisclaimer: true, source });
  }

  // ===== DAILY INSIGHT (cache sekali per hari per profil, §5.1 poin 7) =====
  const { data: cached } = await db
    .from("ai_insights").select("content, created_at")
    .eq("profile_id", profileId).eq("insight_type", "daily")
    .gte("created_at", `${todayKey}T00:00:00Z`)
    .maybeSingle();
  if (cached) return json({ insight: JSON.parse(cached.content), source: "cache" });

  const ctxParsed = insightContextSchema.safeParse(payload.context);
  if (!ctxParsed.success) return json({ error: "konteks insight tidak valid" }, 400);

  const result = await callValidated(
    prompt.system,
    prompt.buildUser({ ...ctxParsed.data, locale }),
    (v) => { const r = dailyInsightSchema.safeParse(v); return r.success ? r.data : null; },
  );

  let insight: DailyInsight = result?.value ?? fallbackDailyInsight(ctxParsed.data);
  let source = result ? "ai" : "fallback";
  if (result && isUnsafeOutput(`${insight.summary} ${insight.motivation} ${insight.targets.join(" ")}`)) {
    console.warn(`unsafe_output_blocked profile=${profileId} useCase=daily_insight`);
    insight = fallbackDailyInsight(ctxParsed.data);
    source = "safety";
  }

  await db.from("ai_insights").insert({
    profile_id: profileId, insight_type: "daily",
    content: JSON.stringify(insight), data_context: ctxParsed.data,
  });
  return json({ insight, source });
  } catch (e) {
    // exception tak tertangani → 500 DENGAN CORS (agar client bisa membacanya) + pesan aslinya
    console.error("ai-gateway crash:", (e as Error)?.message, (e as Error)?.stack);
    return json({ error: "internal", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
