"use client";
import { ramadanWrapped, type RamadanWrapped, type FastingDayEntry } from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";
import { getFastingSettings } from "./fasting";

/**
 * Ramadan Wrapped (Fase 9 · RW-1) — rakit rekap dari rentang Ramadan yang tersimpan (settings) +
 * catatan `fasting_days` profil aktif, lalu jalankan engine deterministik @arta/core. null bila
 * rentang Ramadan belum diatur (fitur inert di luar musim). Non-medis.
 *
 * PENTING: jepit akhir rentang ke HARI INI agar hari masa depan (yang default dihitung puasa) tak
 * membengkakkan rekap — pra-musim (hari ini < awal) → rentang kosong → kartu tak muncul; dalam
 * musim → rekap "sejauh ini"; pasca-musim → rekap penuh.
 */
const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function ramadanWrappedData(nowKey = todayKey()): Promise<RamadanWrapped | null> {
  const s = await getFastingSettings();
  if (!s.ramadanStart || !s.ramadanEnd) return null;
  const effectiveEnd = s.ramadanEnd < nowKey ? s.ramadanEnd : nowKey; // min(ramadanEnd, hari ini)
  const pid = await getActiveProfileId();
  const entries: FastingDayEntry[] = (await db.fasting_days.toArray())
    .filter((r) => r.profileId === pid)
    .map((r) => ({ date: r.date, status: r.status }));
  return ramadanWrapped({ entries, startDate: s.ramadanStart, endDate: effectiveEnd });
}
