// ArtaHealth · Edge Function `consultation-share` (V3-1 · MK-2)
// Buat/cabut snapshot laporan konsultasi TERENKRIPSI untuk dibagikan ke dokter.
// Auth: JWT user (verify_jwt default) → klien user-scoped → RLS enforce kepemilikan.
//   * action "create": enkripsi payload + simpan {token, ciphertext, iv, expires_at} → return {token, expiresAt}
//   * action "revoke": set revoked_at (hanya milik akun)
// Payload plaintext TAK PERNAH tersimpan (lihat _shared/report-crypto.ts). Data T1.
//
// Deploy: supabase functions deploy consultation-share
// Butuh env: CONSULTATION_ENC_KEY (base64 32 byte), SUPABASE_URL, SUPABASE_ANON_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptJson, randomToken } from "../_shared/report-crypto.ts";

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

const MAX_TTL_MIN = 24 * 60; // batas atas 24 jam
const DEFAULT_TTL_MIN = 45;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Butuh autentikasi" }, 401);

  // Klien user-scoped → RLS berlaku (auth.uid() dari JWT pemanggil).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  let body: {
    action?: string; profileId?: string; report?: unknown; ttlMinutes?: number; token?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "Body JSON tidak valid" }, 400); }

  try {
    if (body.action === "revoke") {
      if (!body.token) return json({ error: "token wajib" }, 400);
      const { error } = await supabase
        .from("consultation_reports").update({ revoked_at: new Date().toISOString() })
        .eq("token", body.token);
      if (error) return json({ error: error.message }, 400);
      return json({ revoked: true });
    }

    if (body.action === "create") {
      if (!body.profileId || body.report == null) return json({ error: "profileId & report wajib" }, 400);
      const ttl = Math.min(MAX_TTL_MIN, Math.max(5, Math.floor(body.ttlMinutes ?? DEFAULT_TTL_MIN)));
      const { ciphertext, iv } = await encryptJson(body.report);
      const token = randomToken();
      const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
      // insert lewat klien user-scoped → RLS with-check memastikan profileId milik akun.
      const { error } = await supabase.from("consultation_reports").insert({
        token, profile_id: body.profileId, ciphertext, iv, expires_at: expiresAt,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ token, expiresAt });
    }

    return json({ error: "action tak dikenal" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
