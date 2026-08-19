// ArtaHealth · Edge Function `nutrition-scan` (Fase 4 · NG-2)
// Vision model MEMBACA label Informasi Nilai Gizi → JSON terstruktur; lapisan
// ini HANYA ekstraksi + validasi. Penilaian (verdict) dihitung DETERMINISTIK di
// client via rule engine `packages/core/nutrition.ts` (offline-capable), sama
// pola dengan klasifikasi biomarker. AI tidak pernah menilai "baik/buruk".
//
// Alur: auth → vision call → parse JSON → Zod → validator sanity §3 →
//        { extracted, sanity } ke client. confidence rendah / sanity issue →
//        client minta konfirmasi user sebelum verdict.
//
// ⚠️ BELUM di-deploy: menyentuh AI Gateway/biaya vision & butuh korpus label riil
//    utk regresi (§10). Deploy = langkah launch Fase 4.
// Deploy: supabase functions deploy nutrition-scan

import { extractedLabelSchema, sanityCheck } from "../../../packages/core/src/nutrition-extract.ts";

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
  "Anda pembaca label Informasi Nilai Gizi (ING) kemasan pangan Indonesia.",
  "Baca ANGKA persis seperti tertera — jangan menghitung, menormalkan, atau menebak.",
  "Kembalikan HANYA JSON sesuai skema: serving_size {value,unit(g|ml)}, servings_per_pack,",
  "net_content, per_serving {energy_kcal,fat_g,sat_fat_g,trans_fat_g,protein_g,carb_g,sugar_g,fiber_g,sodium_mg},",
  "akg_basis_kcal, ingredients_raw, dan confidence 0..1 per field.",
  "Natrium SELALU dalam mg. Bila suatu nilai tidak terbaca jelas, beri confidence rendah (<0.7), jangan mengarang.",
].join(" ");

async function callVision(imageUrl: string): Promise<{ content: string }> {
  const cfg = providerConfig();
  if (!cfg.baseUrl || !cfg.apiKey) throw new Error("provider belum dikonfigurasi");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Ekstrak tabel Informasi Nilai Gizi & daftar bahan dari foto ini menjadi JSON." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`provider ${res.status}`);
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
    // Platform sudah verify_jwt → cukup pastikan ada klaim sub (tanpa round-trip GoTrue).
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

    // 1) vision → 2) parse → 3) Zod (retry 1×) → 4) sanity
    let extracted: unknown = null;
    for (let attempt = 0; attempt < 2 && extracted === null; attempt++) {
      try {
        const { content } = await callVision(imageUrl);
        const parsed = extractedLabelSchema.safeParse(parseJsonLoose(content));
        if (parsed.success) extracted = parsed.data;
      } catch { /* retry lalu menyerah */ }
    }
    if (extracted === null) {
      // foto bukan label / tak terbaca → pesan ramah (bukan error teknis)
      return json({ error: "not_a_label", message: "Kami tidak menemukan tabel Informasi Nilai Gizi. Coba foto bagian belakang kemasan." }, 422);
    }

    const sanity = sanityCheck(extracted as Parameters<typeof sanityCheck>[0]);
    return json({ extracted, sanity, source: "ai" });
  } catch (e) {
    console.error("nutrition-scan crash:", (e as Error)?.message);
    return json({ error: "internal", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
