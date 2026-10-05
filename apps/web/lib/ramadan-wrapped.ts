"use client";
import { ramadanWrapped, type RamadanWrapped, type FastingDayEntry } from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";
import { getFastingSettings } from "./fasting";

/**
 * Ramadan Wrapped (Fase 9 · RW-1) — rakit rekap dari rentang Ramadan yang tersimpan (settings) +
 * catatan `fasting_days` profil aktif, lalu jalankan engine deterministik @arta/core. null bila
 * rentang Ramadan belum diatur (fitur inert di luar musim). Non-medis.
 */
export async function ramadanWrappedData(): Promise<RamadanWrapped | null> {
  const s = await getFastingSettings();
  if (!s.ramadanStart || !s.ramadanEnd) return null;
  const pid = await getActiveProfileId();
  const entries: FastingDayEntry[] = (await db.fasting_days.toArray())
    .filter((r) => r.profileId === pid)
    .map((r) => ({ date: r.date, status: r.status }));
  return ramadanWrapped({ entries, startDate: s.ramadanStart, endDate: s.ramadanEnd });
}
