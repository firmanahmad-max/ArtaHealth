// ArtaHealth · Edge Function `claim-check` (V3-4 · CK-2)
// Penilaian AI BERPAGAR untuk klaim kesehatan viral. Alur:
//   auth → gerbang deterministik (assessClaimSafety) → LLM (hanya bila allow_ai) → Zod →
//   retry 1× → fallback template. Non-vonis mutlak, non-medis; selalu arahkan ke sumber resmi.
// Klaim berisiko/di luar domain TIDAK dikirim ke LLM (dikembalikan template gerbang).
//
// Deploy: supabase functions deploy claim-check  (reuse secret SUMOPOD_*/AI_MODEL).
// GERBANG KONTEN wajib lewat (kurasi sumber + review medis) sebelum flag nyala.

import { assessClaimSafety } from "../../../packages/core/src/claim-safety.ts";
import {
  claimAssessmentSchema, fallbackAssessment, CURATED_SOURCES, CLAIM_STANCES,
} from "../../../packages/core/src/claim-check.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function providerConfig(): { baseUrl: string; apiKey: string; model: string } {
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

const SOURCE_LIST = CURATED_SOURCES.map((s) => `- ${s.label}${s.url ? ` (${s.url})` : ""}`).join("\n");
const SYSTEM = [
  "Anda asisten literasi kesehatan Indonesia yang membantu pengguna memilah klaim kesehatan viral.",
  "ATURAN KERAS:",
  "- JANGAN memberi diagnosis, dosis, atau menyuruh mulai/berhenti/ganti obat.",
  "- JANGAN memberi vonis 'benar/salah' mutlak; nilai tingkat dukungan bukti.",
  "- Rujuk HANYA sumber resmi berikut (atau badan resmi setara), sertakan minimal 1:",
  SOURCE_LIST,
  "- Selalu ingatkan untuk konsultasi tenaga kesehatan untuk keputusan pribadi.",
  `Kembalikan HANYA JSON: { "stance": salah satu dari ${CLAIM_STANCES.map((s) => `"${s}"`).join("|")}, `,
  '"ringkasan": penjelasan singkat & netral (bahasa Indonesia), ',
  '"sumber": [{ "label": string, "url": string opsional }], "catatan_keamanan": string opsional }.',
].join("\n");

async function callProvider(user: string): Promise<string> {
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
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `Klaim: "${user}"` }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`provider ${res.status}`);
    const body = await res.json();
    return body?.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

function parse(content: string): unknown | null {
  try { return JSON.parse(content); } catch { /* coba ekstrak blok JSON */ }
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* noop */ } }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!req.headers.get("Authorization")) return json({ error: "Butuh autentikasi" }, 401);

  let claim = "";
  try { claim = String((await req.json())?.claim ?? "").trim(); } catch { /* noop */ }
  if (!claim) return json({ error: "claim wajib" }, 400);

  // Gerbang deterministik SERVER-SIDE (defense in depth) — jangan panggil LLM utk klaim berisiko.
  const safety = assessClaimSafety(claim);
  if (safety.action !== "allow_ai") {
    return json({ gated: true, safety });
  }

  // AI berpagar + validasi Zod + retry 1× + fallback.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = parse(await callProvider(claim));
      const check = claimAssessmentSchema.safeParse(parsed);
      if (check.success) return json({ gated: false, assessment: check.data });
    } catch (_e) { /* lanjut retry/fallback */ }
  }
  return json({ gated: false, assessment: fallbackAssessment(), fallback: true });
});
