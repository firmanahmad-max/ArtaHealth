"use client";
import { useEffect, useState } from "react";
import type { FocusItem, FocusTone } from "@arta/core";
import { todayFocusItems } from "@/lib/today-focus";
import { useMounted } from "@/lib/useMounted";

/**
 * Fokus Hari Ini (Fase 8 · KR-1) — kartu ringkas di atas Beranda: 1–3 ajakan/insight harian
 * deterministik untuk retensi & aktivasi. Non-medis. Flag NEXT_PUBLIC_FEATURE_FOCUS.
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
    void todayFocusItems().then(setItems);
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
