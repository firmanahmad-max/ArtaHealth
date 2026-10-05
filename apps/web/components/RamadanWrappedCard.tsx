"use client";
import { useEffect, useState } from "react";
import type { RamadanWrapped, RamadanTier } from "@arta/core";
import { ramadanWrappedData } from "@/lib/ramadan-wrapped";
import { useMounted } from "@/lib/useMounted";

/**
 * Ramadan Wrapped (Fase 9 · RW-1) — kartu rekap bulan puasa: hari berpuasa, rentetan terpanjang,
 * % penyelesaian + headline hangat. Delight/retensi musiman; sembunyi di luar musim (rentang
 * Ramadan belum diatur). Non-medis & non-menghakimi. Flag NEXT_PUBLIC_FEATURE_RAMADAN_WRAPPED.
 */

const TIER_COLOR: Record<RamadanTier, string> = {
  penuh: "var(--ah-score-excellent)", kuat: "var(--ah-score-excellent)",
  baik: "var(--ah-score-fair)", mulai: "var(--ah-text-tertiary)",
};

export function RamadanWrappedCard() {
  const mounted = useMounted();
  const [w, setW] = useState<RamadanWrapped | null>(null);

  useEffect(() => {
    if (!mounted) return;
    void ramadanWrappedData().then(setW);
  }, [mounted]);

  if (!w || w.totalDays === 0) return null; // di luar musim / rentang belum diatur

  const color = TIER_COLOR[w.tier];
  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌙 Ramadan Wrapped</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>Rekap bulan puasamu — untuk disyukuri, bukan dinilai.</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ ...ring, borderColor: color }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1 }}>{w.completionPct}%</span>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--ah-text-tertiary)" }}>penyelesaian</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Stat value={`${w.fastedDays}/${w.totalDays}`} label="hari puasa" />
          <Stat value={w.longestStreak > 0 ? `🔥 ${w.longestStreak}` : "—"} label="rentetan" />
          {w.missedDays > 0 && <Stat value={String(w.missedDays)} label="untuk diqadha" />}
        </div>
      </div>

      <p style={{ fontSize: 12, fontWeight: 600, color, lineHeight: 1.45 }}>{w.headline}</p>
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Hari tanpa puasa (sehat, safar, haid, dsb.) dihormati — hanya dihitung untuk pengingat qadha, tanpa menilai.
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={stat}>
      <p style={{ fontSize: 14, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 9, color: "var(--ah-text-tertiary)", marginTop: 3 }}>{label}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-gradient-soft, var(--ah-surface-1))", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const ring: React.CSSProperties = {
  width: 72, height: 72, borderRadius: "50%", flexShrink: 0, border: "3px solid",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
};
const stat: React.CSSProperties = {
  flex: 1, minWidth: 68, textAlign: "center", padding: "8px 4px",
  borderRadius: "var(--ah-r-inner)", background: "var(--ah-surface-2)", border: "1px solid var(--ah-border)",
};
