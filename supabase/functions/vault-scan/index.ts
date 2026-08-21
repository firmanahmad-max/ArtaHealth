// ArtaHealth · Edge Function `vault-scan` (Fase 6 #1 · MV-2)
// Vision OCR hasil lab → nilai terstruktur (GDP/GDS/PP2/HbA1c, lipid, asam urat, tensi).
// Lapisan ini HANYA OCR; KLASIFIKASI biomarker dihitung DETERMINISTIK di client via
// engine Fase 2 (classifyBiomarker). AI tidak pernah menilai "normal/tinggi".
//
// Alur: auth → vision → parse → Zod (extractedLabSchema) → labSanity → { extracted, sanity }.
// Foto bukan hasil lab / tak ada nilai → 422 not_a_lab.
//
// Deploy: supabase functions deploy vault-scan  (reuse secret SUMOPOD_*/AI_MODEL_VISION).

import { extractedLabSchema, labSanity, resolveLabValues } from "../../../packages/core/src/vault-extract.ts";

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
      model: Deno.env.get("AI_MODEL_VISION") ?? "gpt-4o-mini",
    };
  }
  return {
    baseUrl: Deno.env.get("SUMOPOD_BASE_URL") ?? "",
    apiKey: Deno.env.get("SUMOPOD_API_KEY") ?? "",
    model: Deno.env.get("AI_MODEL_VISION") ?? Deno.env.get("AI_MODEL") ?? "gpt-4o-mini",
  };
}

const SYSTEM = [
  "Anda pembaca hasil pemeriksaan laboratorium medis Indonesia.",
  "Baca ANGKA persis seperti tertera — jangan menghitung, menormalkan, atau menebak.",
  "Kembalikan HANYA JSON: { test_date, glucose {gdp,gds,pp2,hba1c}, lipid {total_chol,ldl,hdl,tg}, uric_acid, bp {systolic,diastolic}, confidence }.",
  "SETIAP nilai ANGKA BIASA (number), bukan objek/string. Satuan: glukosa & lipid mg/dL, HbA1c %, asam urat mg/dL, tensi mmHg.",
  "gdp=glukosa puasa, gds=sewaktu, pp2=2 jam PP, hba1c. Sertakan HANYA yang ADA di hasil lab; sisanya hilangkan.",
  "confidence hanya di objek terpisah {nama_field: 0..1}. Bila tak yakin beri confidence rendah, jangan mengarang.",
].join(" ");

async function callVision(imageUrl: string): Promise<{ content: string }> {
  const cfg = providerConfig();
  if (!cfg.baseUrl || !cfg.apiKey) throw new Error("provider belum dikonfigurasi");
  const isReasoning = /^(gpt-5|o[0-9])/i.test(cfg.model);
  const payload: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Ekstrak nilai hasil lab dari foto ini menjadi JSON." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };
  if (isReasoning) {
    payload.max_completion_tokens = 2000;
    payload.reasoning_effort = "minimal";
  } else {
    payload.temperature = 0;
    payload.max_tokens = 900;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("vault-scan vision provider error", res.status, errText.slice(0, 500));
      throw new Error(`provider ${res.status}`);
    }
    const body = await res.json();
    return { content: body?.choices?.[0]?.message?.content ?? "" };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(trimmed);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method tidak didukung" }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    try {
      const part = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
      const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
      userId = JSON.parse(atob(padded)).sub ?? null;
    } catch { userId = null; }
    if (!userId) return json({ error: "unauthorized" }, 401);

    const bodyReq = await req.json().catch(() => ({})) as { imageUrl?: string };
    const imageUrl = typeof bodyReq.imageUrl === "string" ? bodyReq.imageUrl : "";
    if (!imageUrl) return json({ error: "imageUrl wajib" }, 400);

    let extracted: unknown = null;
    let lastContent = "";
    let lastIssue = "";
    for (let attempt = 0; attempt < 2 && extracted === null; attempt++) {
      try {
        const { content } = await callVision(imageUrl);
        lastContent = content;
        const parsed = extractedLabSchema.safeParse(parseJsonLoose(content));
        if (parsed.success && resolveLabValues(parsed.data).length > 0) extracted = parsed.data;
        else lastIssue = parsed.success ? "tak ada nilai lab" : JSON.stringify(parsed.error.issues).slice(0, 400);
      } catch (e) { lastIssue = "callVision/parse: " + ((e as Error)?.message ?? String(e)); }
    }
    if (extracted === null) {
      console.error("vault-scan ekstraksi gagal", { model: providerConfig().model, lastIssue, preview: lastContent.slice(0, 600) });
      return json({ error: "not_a_lab", message: "Kami tak menemukan nilai lab. Coba foto hasil lab yang jelas & lengkap." }, 422);
    }

    const sanity = labSanity(extracted as Parameters<typeof labSanity>[0]);
    return json({ extracted, sanity, source: "ai" });
  } catch (e) {
    console.error("vault-scan crash:", (e as Error)?.message);
    return json({ error: "internal", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
