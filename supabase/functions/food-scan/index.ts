// ArtaHealth · Edge Function `food-scan` (Fase 6 · FD-2)
// Vision model MENGIDENTIFIKASI hidangan + perkiraan porsi dari foto masakan → JSON.
// Lapisan ini HANYA identifikasi; gizi dihitung DETERMINISTIK di client via FOOD_DB
// (packages/core/food-extract.ts → resolveMeal). AI tidak pernah menebak angka gizi.
//
// Alur: auth → vision → parse JSON → Zod (identifiedMealSchema) → { identified } ke client.
// Estimasi foto masakan < akurasi label — client wajib "perkiraan" + koreksi porsi user.
//
// Deploy: supabase functions deploy food-scan  (butuh secret SUMOPOD_*/AI_MODEL_VISION,
//         dipakai bersama nutrition-scan/ai-gateway).

import { identifiedMealSchema } from "../../../packages/core/src/food-extract.ts";

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
  "Anda ahli mengenali masakan Indonesia dari foto.",
  "Identifikasi SETIAP hidangan/komponen di piring + perkiraan porsi dalam gram.",
  "Kembalikan HANYA JSON: { dishes: [{ name, portion_g, portion_desc, confidence }], meal_type }.",
  "name = nama hidangan Bahasa Indonesia yang umum (mis. 'Nasi goreng', 'Ayam goreng', 'Tempe goreng').",
  "portion_g = ANGKA BIASA gram (number, bukan objek/string). portion_desc = deskripsi porsi (mis. '1 piring').",
  "meal_type salah satu: sarapan|siang|malam|camilan. confidence 0..1 per hidangan.",
  "Jangan mengarang; bila tak yakin beri confidence rendah (<0.7). Jangan menebak angka gizi/kalori.",
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
          { type: "text", text: "Identifikasi hidangan & perkiraan porsi dari foto makanan ini menjadi JSON." },
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
      console.error("food-scan vision provider error", res.status, errText.slice(0, 500));
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

    let identified: unknown = null;
    let lastContent = "";
    let lastIssue = "";
    for (let attempt = 0; attempt < 2 && identified === null; attempt++) {
      try {
        const { content } = await callVision(imageUrl);
        lastContent = content;
        const parsed = identifiedMealSchema.safeParse(parseJsonLoose(content));
        if (parsed.success && parsed.data.dishes.length > 0) identified = parsed.data;
        else lastIssue = parsed.success ? "dishes kosong" : JSON.stringify(parsed.error.issues).slice(0, 400);
      } catch (e) { lastIssue = "callVision/parse: " + ((e as Error)?.message ?? String(e)); }
    }
    if (identified === null) {
      console.error("food-scan identifikasi gagal", { model: providerConfig().model, lastIssue, preview: lastContent.slice(0, 600) });
      return json({ error: "no_food", message: "Kami tak mengenali makanan di foto. Coba foto lebih jelas dari atas." }, 422);
    }

    return json({ identified, source: "ai" });
  } catch (e) {
    console.error("food-scan crash:", (e as Error)?.message);
    return json({ error: "internal", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
