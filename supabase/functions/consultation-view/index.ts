// ArtaHealth · Edge Function `consultation-view` (V3-1 · MK-2)
// Baca PUBLIK read-only snapshot laporan konsultasi via token (untuk dokter).
// Pakai SERVICE ROLE (bypass RLS) tapi HANYA mengembalikan baris yang token-nya persis
// (tak tertebak) + belum kedaluwarsa + belum dicabut. Dekripsi payload → return JSON.
// Tak ada data lain yang bisa diakses. Dipanggil dari halaman publik /r/[token] dgn anon key.
//
// Deploy: supabase functions deploy consultation-view
// Butuh env: CONSULTATION_ENC_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptJson } from "../_shared/report-crypto.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let token: string | undefined;
  try {
    if (req.method === "POST") token = (await req.json())?.token;
    else token = new URL(req.url).searchParams.get("token") ?? undefined;
  } catch { /* abaikan */ }
  if (!token) return json({ error: "token wajib" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data, error } = await supabase
      .from("consultation_reports")
      .select("ciphertext, iv, expires_at, revoked_at")
      .eq("token", token)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "not_found" }, 404);
    if (data.revoked_at) return json({ error: "revoked" }, 410);
    if (new Date(data.expires_at).getTime() < Date.now()) return json({ error: "expired" }, 410);

    const report = await decryptJson(data.ciphertext as string, data.iv as string);
    return json({ report, expiresAt: data.expires_at });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
