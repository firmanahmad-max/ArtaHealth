"use client";
import { immunizationPlan, type ImmunizationEntry } from "@arta/core";
import { db } from "./db";

/**
 * Jadwal Imunisasi Anak (V3-6) — simpan tanggal lahir & vaksin yang sudah diberikan
 * secara LOKAL (tabel meta, tanpa migrasi/sync di MVP), lalu turunkan rencana via engine
 * core. Per-anak/Family + sync = follow-up. Non-medis (jadwal IDAI, perlu verifikasi).
 */

const DOB_KEY = "imm:dob";
const GIVEN_KEY = "imm:given";

export async function getChildDob(): Promise<string | null> {
  return ((await db.meta.get(DOB_KEY))?.value as string) ?? null;
}
export async function setChildDob(iso: string): Promise<void> {
  await db.meta.put({ key: DOB_KEY, value: iso });
}

export async function getGiven(): Promise<string[]> {
  const raw = (await db.meta.get(GIVEN_KEY))?.value as string | undefined;
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}
export async function toggleGiven(key: string): Promise<void> {
  const cur = new Set(await getGiven());
  cur.has(key) ? cur.delete(key) : cur.add(key);
  await db.meta.put({ key: GIVEN_KEY, value: JSON.stringify([...cur]) });
}

/** Rencana imunisasi dari data lokal (dob + given). null bila tanggal lahir belum diisi. */
export async function childImmunizationPlan(nowMs = Date.now()): Promise<{ dob: string; plan: ImmunizationEntry[] } | null> {
  const dob = await getChildDob();
  if (!dob) return null;
  return { dob, plan: immunizationPlan(dob, await getGiven(), nowMs) };
}
