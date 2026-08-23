"use client";
import type { ConsultationReport } from "@arta/core";
import { getSupabase } from "./supabase";
import { getActiveProfileId, LOCAL_PROFILE_ID } from "./sync";

/**
 * Mode Konsultasi berbagi (V3-1 · MK-2). Buat/cabut link + QR read-only ber-TTL untuk
 * dokter. Snapshot laporan dienkripsi & disimpan server-side (Edge Function
 * consultation-share); dibaca publik via consultation-view. Turun anggun bila
 * offline/lokal/belum-deploy. Data T1 — gerbang privasi (roadmap-v3 §6.8).
 */

export interface ShareLink {
  url: string;        // /r/<token>
  token: string;
  expiresAt: string;  // ISO
}

export type ShareResult =
  | { ok: true; link: ShareLink }
  | { ok: false; message: string };

/** Buat link berbagi (default TTL 45 menit). */
export async function createShareLink(report: ConsultationReport, ttlMinutes = 45): Promise<ShareResult> {
  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (!supabase || profileId === LOCAL_PROFILE_ID || !online) {
    return { ok: false, message: "Berbagi link belum aktif di sesi ini (perlu login & online). Sementara pakai Cetak/PDF." };
  }
  try {
    const { data, error } = await supabase.functions.invoke("consultation-share", {
      body: { action: "create", profileId, report, ttlMinutes },
    });
    if (error || !(data as { token?: string })?.token) {
      return { ok: false, message: "Gagal membuat link. Coba lagi, atau gunakan Cetak/PDF." };
    }
    const { token, expiresAt } = data as { token: string; expiresAt: string };
    return { ok: true, link: { url: `${location.origin}/r/${token}`, token, expiresAt } };
  } catch {
    return { ok: false, message: "Gagal membuat link (jaringan). Gunakan Cetak/PDF." };
  }
}

/** Cabut link (tak bisa dibuka lagi). */
export async function revokeShareLink(token: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.functions.invoke("consultation-share", {
      body: { action: "revoke", token },
    });
    return !error;
  } catch {
    return false;
  }
}

/** Ambil snapshot publik via token (untuk halaman /r/[token]). */
export async function fetchSharedReport(token: string): Promise<
  | { ok: true; report: ConsultationReport; expiresAt: string }
  | { ok: false; reason: "not_found" | "expired" | "revoked" | "error"; message: string }
> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: "error", message: "Layanan tak tersedia." };
  try {
    const { data, error } = await supabase.functions.invoke("consultation-view", { body: { token } });
    if (error) {
      const status = (error as { context?: { status?: number } })?.context?.status;
      if (status === 404) return { ok: false, reason: "not_found", message: "Laporan tak ditemukan." };
      if (status === 410) return { ok: false, reason: "expired", message: "Link kedaluwarsa atau sudah dicabut." };
      return { ok: false, reason: "error", message: "Gagal memuat laporan." };
    }
    const d = data as { report?: ConsultationReport; expiresAt?: string };
    if (!d?.report) return { ok: false, reason: "not_found", message: "Laporan tak ditemukan." };
    return { ok: true, report: d.report, expiresAt: d.expiresAt ?? "" };
  } catch {
    return { ok: false, reason: "error", message: "Gagal memuat laporan (jaringan)." };
  }
}
