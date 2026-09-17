"use client";
import { useEffect, useState } from "react";
import type { FocusItem, FocusTone } from "@arta/core";
import { todayFocusItems } from "@/lib/today-focus";
import { buildInsightContext, hasEnoughData } from "@/lib/insight";
import { useMounted } from "@/lib/useMounted";

/**
 * Fokus Hari Ini (Fase 8 · KR-1) — panduan harian deterministik di atas Beranda. Konsolidasi:
 * SALING-MELENGKAPI dengan "Insight hari ini" (AI). Saat Insight tampil (data cukup) kartu ini
 * menyusut ke item kritis-waktu saja (rentetan di ambang putus); saat Insight absen (data minim/
 * AI mati) kartu ini jadi panduan penuh (1–3 item). Non-medis. Flag NEXT_PUBLIC_FEATURE_FOCUS.
 */

const TONE: Record<FocusTone, { color: string; bg: string }> = {
  do: { color: "var(--ah-text-primary)", bg: "var(--ah-surface-2)" },
  warn: { color: "#FB923C", bg: "rgba(251,146,60,0.12)" },
  celebrate: { color: "var(--ah-score-excellent)", bg: "rgba(52,211,153,0.12)" },
};

export function TodayFocusCard() {
  const mounted = useMounted();
  const [items, setItems] = useState<FocusItem[] | null>(null);

  useEffect(() => {
    if (!mounted) return;
    void (async () => {
      const [all, { context }] = await Promise.all([todayFocusItems(), buildInsightContext()]);
      // Insight AI tampil bila data cukup → di sini sisakan hanya item kritis-waktu (rentetan)
      // agar tak dobel; Insight absen → panduan penuh.
      const shown = hasEnoughData(context) ? all.filter((i) => i.id === "streak") : all;
      setItems(shown);
    })();
  }, [mounted]);

  if (!items || items.length === 0) return null;

  return (
    <div style={card}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)" }}>🎯 Fokus Hari Ini</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => {
          const t = TONE[it.tone];
          return (
            <div key={it.id} style={{ ...row, background: t.bg }}>
              <span style={{ fontSize: 16 }}>{it.icon}</span>
              <p style={{ fontSize: 12, color: t.color, lineHeight: 1.4, fontWeight: it.tone === "warn" ? 700 : 500 }}>{it.title}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 10,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: "var(--ah-r-inner)",
};
