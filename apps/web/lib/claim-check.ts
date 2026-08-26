"use client";
import {
  assessClaimSafety, type ClaimSafety, type ClaimAssessment,
} from "@arta/core";
import { getSupabase } from "./supabase";

/**
 * Cek Klaim (V3-4). Jalankan gerbang deterministik (CK-1) di klien dulu; hanya klaim
 * `allow_ai` yang dikirim ke Edge Function `claim-check` (CK-2, AI berpagar). Turun anggun
 * saat offline/lokal/belum-deploy. Non-vonis, non-medis.
 */

export type CheckResult =
  | { kind: "gated"; safety: ClaimSafety }                 // ditolak/eskalasi oleh gerbang (tanpa AI)
  | { kind: "assessment"; assessment: ClaimAssessment; fallback: boolean }
  | { kind: "error"; message: string };

export async function checkClaim(claim: string): Promise<CheckResult> {
  const text = (claim ?? "").trim();
  // Gerbang deterministik lokal (cepat, tanpa jaringan).
  const safety = assessClaimSafety(text);
  if (safety.action !== "allow_ai") return { kind: "gated", safety };

  const supabase = getSupabase();
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (!supabase || !online) {
    return { kind: "error", message: "Pemeriksaan AI belum aktif di sesi ini (perlu login & online). Untuk sementara, rujuk sumber resmi." };
  }
  try {
    const { data, error } = await supabase.functions.invoke("claim-check", { body: { claim: text } });
    if (error) return { kind: "error", message: "Gagal memeriksa klaim. Coba lagi, atau rujuk sumber resmi." };
    const d = data as { gated?: boolean; safety?: ClaimSafety; assessment?: ClaimAssessment; fallback?: boolean };
    if (d?.gated && d.safety) return { kind: "gated", safety: d.safety };
    if (d?.assessment) return { kind: "assessment", assessment: d.assessment, fallback: !!d.fallback };
    return { kind: "error", message: "Hasil tak terbaca. Rujuk sumber resmi." };
  } catch {
    return { kind: "error", message: "Gagal memeriksa klaim (jaringan). Rujuk sumber resmi." };
  }
}
