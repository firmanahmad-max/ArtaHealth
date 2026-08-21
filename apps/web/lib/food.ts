"use client";
import { identifiedMealSchema, type IdentifiedMeal } from "@arta/core";
import { getSupabase } from "./supabase";
import { getActiveProfileId, LOCAL_PROFILE_ID } from "./sync";

/**
 * Food Diary AI (Fase 6 · FD-3) — panggil Edge Function `food-scan` (vision identifikasi
 * hidangan). Gizi dihitung DETERMINISTIK di client via resolveMeal (core). Turun anggun
 * saat mode lokal/offline/belum-deploy — jalur tambah hidangan manual tetap jalan.
 * ⚠️ food-scan BELUM di-deploy → jalur foto runtime-untested sampai langkah launch.
 */

export type ScanMealResult =
  | { ok: true; identified: IdentifiedMeal }
  | { ok: false; reason: "unavailable" | "no_food" | "error"; message: string };

export async function scanMeal(imageDataUrl: string): Promise<ScanMealResult> {
  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (!supabase || profileId === LOCAL_PROFILE_ID || !online) {
    return { ok: false, reason: "unavailable", message: "Foto makanan belum aktif di sesi ini — tambah hidangan manual dulu, ya." };
  }
  try {
    const { data, error } = await supabase.functions.invoke("food-scan", { body: { imageUrl: imageDataUrl } });
    if (error) {
      const ctx = (error as { context?: { message?: string } })?.context;
      if (ctx?.message) return { ok: false, reason: "no_food", message: ctx.message };
      return { ok: false, reason: "error", message: "Gagal mengenali makanan. Coba lagi atau tambah manual." };
    }
    const parsed = identifiedMealSchema.safeParse((data as { identified?: unknown })?.identified);
    if (!parsed.success || parsed.data.dishes.length === 0) {
      return { ok: false, reason: "no_food", message: "Kami tak mengenali makanan di foto. Tambah hidangan manual, ya." };
    }
    return { ok: true, identified: parsed.data };
  } catch {
    return { ok: false, reason: "error", message: "Gagal mengenali makanan. Coba lagi atau tambah manual." };
  }
}
