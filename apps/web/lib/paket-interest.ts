"use client";
import type { PaketChoice } from "@arta/core";
import { db } from "./db";
import { getSupabase } from "./supabase";
import { getActiveProfileId, LOCAL_PROFILE_ID } from "./sync";

/**
 * Validasi minat Paket Ramadan (Fase 9 · RW-4a) — simpan pilihan pengguna LOKAL (meta) agar kartu
 * langsung tahu statusnya, lalu kirim ke Supabase (`paket_interest`, satu baris per profil) bila
 * tersedia. Best-effort: gagal/offline → ditandai belum terkirim & dicoba lagi saat kartu dibuka.
 * Tanpa pembayaran, tanpa data kesehatan.
 */

const KEY_CHOICE = "paket:choice";
const KEY_SYNCED = "paket:synced";
const CHOICES: PaketChoice[] = ["season", "season_syawal", "pro_annual", "not_now"];

export async function getPaketChoice(): Promise<PaketChoice | null> {
  const v = (await db.meta.get(KEY_CHOICE))?.value;
  return v && (CHOICES as string[]).includes(v) ? (v as PaketChoice) : null;
}

/** Kirim pilihan ke server. true bila tersimpan; false bila tak ada sesi/backend atau gagal. */
async function pushChoice(choice: PaketChoice): Promise<boolean> {
  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  if (!supabase || profileId === LOCAL_PROFILE_ID) return false;
  const { error } = await supabase.from("paket_interest")
    .upsert({ profile_id: profileId, choice }, { onConflict: "profile_id" });
  return !error;
}

export async function savePaketChoice(choice: PaketChoice): Promise<void> {
  await db.meta.bulkPut([{ key: KEY_CHOICE, value: choice }, { key: KEY_SYNCED, value: "0" }]);
  if (await pushChoice(choice)) await db.meta.put({ key: KEY_SYNCED, value: "1" });
}

/** Coba kirim ulang pilihan yang belum tersinkron (dipanggil saat kartu dibuka). */
export async function retryPaketSync(): Promise<void> {
  const choice = await getPaketChoice();
  if (!choice || (await db.meta.get(KEY_SYNCED))?.value === "1") return;
  if (await pushChoice(choice)) await db.meta.put({ key: KEY_SYNCED, value: "1" });
}
