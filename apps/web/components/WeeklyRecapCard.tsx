"use client";
import { useEffect, useState } from "react";
import type { WeeklyRecap } from "@arta/core";
import { weeklyRecapData } from "@/lib/weekly-recap";
import { useMounted } from "@/lib/useMounted";

/**
 * Ringkasan Mingguan (Fase 8 · KR-5) — kartu refleksi konsistensi minggu ini (hari aktif, catatan,
 * streak) + kalimat motivasi. Retensi: alasan kembali & melihat progres. Non-medis. Sembunyi bila
 * belum ada aktivitas minggu ini. Flag NEXT_PUBLIC_FEATURE_WEEKLY_RECAP.
 */

export function WeeklyRecapCard() {
  const mounted = useMounted();
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);

  useEffect(() => {
    if (!mounted) return;
    void weeklyRecapData().then(setRecap);
  }, [mounted]);

  if (!recap || recap.activeDays === 0) return null; // belum ada aktivitas minggu ini

  return (
    <div style={card}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>📅 Minggu Ini</p>

      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} aria-hidden style={{ flex: 1, height: 8, borderRadius: "var(--ah-r-full)",
            background: i < recap.activeDays ? "var(--ah-accent)" : "var(--ah-surface-2)" }} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Stat value={`${recap.activeDays}/7`} label="hari aktif" />
        <Stat value={String(recap.totalLogs)} label="catatan" />
        <Stat value={recap.streak > 0 ? `🔥 ${recap.streak}` : "—"} label="rentetan" />
      </div>

      <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.45 }}>{recap.headline}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={stat}>
      <p style={{ fontSize: 15, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)", marginTop: 3 }}>{label}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 10,
};
const stat: React.CSSProperties = {
  flex: 1, textAlign: "center", padding: "8px 4px",
  borderRadius: "var(--ah-r-inner)", background: "var(--ah-surface-2)", border: "1px solid var(--ah-border)",
};
