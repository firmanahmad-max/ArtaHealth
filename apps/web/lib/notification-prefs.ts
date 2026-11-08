"use client";
import { normalizeMuted, type NotificationCategory } from "@arta/core";
import { db } from "./db";
import { getSupabase } from "./supabase";
import { getActiveProfileId, LOCAL_PROFILE_ID } from "./sync";

/**
 * Preferensi jenis pengingat — disimpan LOKAL (meta) agar UI langsung responsif, lalu dikirim ke
 * Supabase (`notification_prefs`, migration 0031) yang dibaca `send-reminders`. Best-effort: gagal/
 * offline → ditandai belum terkirim & dicoba lagi saat panel dibuka. Bila lokal sudah tersinkron,
 * nilai server (mis. diubah dari perangkat lain) menang.
 */

const KEY_MUTED = "notif:muted";
const KEY_SYNCED = "notif:synced";

async function readLocal(): Promise<NotificationCategory[]> {
  const raw = (await db.meta.get(KEY_MUTED))?.value;
  if (!raw) return [];
  try { return normalizeMuted(JSON.parse(raw)); } catch { return []; }
}

async function writeLocal(muted: NotificationCategory[], synced: boolean): Promise<void> {
  await db.meta.bulkPut([
    { key: KEY_MUTED, value: JSON.stringify(muted) },
    { key: KEY_SYNCED, value: synced ? "1" : "0" },
  ]);
}

async function pushMuted(muted: NotificationCategory[]): Promise<boolean> {
  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  if (!supabase || profileId === LOCAL_PROFILE_ID) return false;
  const { error } = await supabase.from("notification_prefs")
    .upsert({ profile_id: profileId, muted }, { onConflict: "profile_id" });
  return !error;
}

/**
 * Muat preferensi: kirim ulang perubahan lokal yang belum tersinkron, atau ambil nilai server bila
 * lokal sudah bersih. Selalu mengembalikan daftar ternormalisasi (kosong = semua aktif).
 */
export async function loadMuted(): Promise<NotificationCategory[]> {
  const local = await readLocal();
  if ((await db.meta.get(KEY_SYNCED))?.value === "0") {
    if (await pushMuted(local)) await db.meta.put({ key: KEY_SYNCED, value: "1" });
    return local;
  }
  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  if (!supabase || profileId === LOCAL_PROFILE_ID) return local;
  const { data, error } = await supabase.from("notification_prefs")
    .select("muted").eq("profile_id", profileId).maybeSingle();
  if (error) return local;
  const remote = normalizeMuted((data as { muted?: unknown } | null)?.muted);
  await writeLocal(remote, true);
  return remote;
}

/** Simpan preferensi. true bila sudah sampai ke server (false = tersimpan lokal, dicoba lagi nanti). */
export async function saveMuted(muted: NotificationCategory[]): Promise<boolean> {
  const clean = normalizeMuted(muted);
  await writeLocal(clean, false);
  const ok = await pushMuted(clean);
  if (ok) await db.meta.put({ key: KEY_SYNCED, value: "1" });
  return ok;
}
