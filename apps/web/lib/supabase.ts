"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase sisi browser (anon key saja — service_role hanya di Edge Functions).
 * Mengembalikan null jika env belum diisi supaya smoke page & CI tetap jalan
 * tanpa project Supabase (lihat README Quickstart langkah 3).
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    client = null;
    return client;
  }
  client = createClient(url, anonKey, {
    auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
  });
  return client;
}

export interface PrimaryProfile {
  id: string;
  display_name: string;
  primary_goal: string | null;
  onboarded_at: string | null;
  target_hydration_ml: number;
  target_steps: number;
  target_sleep_min: number;
}

/** Profil primary milik akun yang sedang login (null = belum onboarding). */
export async function getPrimaryProfile(): Promise<PrimaryProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, primary_goal, onboarded_at, target_hydration_ml, target_steps, target_sleep_min")
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return null;
  return data;
}
