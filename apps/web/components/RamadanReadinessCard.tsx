"use client";
import { useEffect, useState } from "react";
import type { RamadanReadiness } from "@arta/core";
import { ramadanReadinessData } from "@/lib/ramadan-readiness";
import { useMounted } from "@/lib/useMounted";

/**
 * Readiness pra-Ramadan (Fase 9 · RW-2) — countdown H-N menuju Ramadan + checklist persiapan.
 * Tampil hanya pra-musim (Ramadan diaktifkan tapi belum mulai). Status saja; aksi di kartu
 * masing-masing. Non-medis. Flag NEXT_PUBLIC_FEATURE_RAMADAN_READINESS.
 */
export function RamadanReadinessCard() {
  const mounted = useMounted();
  const [r, setR] = useState<RamadanReadiness | null>(null);

  useEffect(() => {
    if (!mounted) return;
    void ramadanReadinessData().then(setR);
  }, [mounted]);

  if (!r) return null; // di luar jendela pra-musim

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={countdown}>
          <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, lineHeight: 1 }}>H-</span>
          <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{r.daysUntilStart}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌙 Menuju Ramadan</p>
          <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
            Persiapan {r.readyCount}/{r.totalCount} selesai.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {r.items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>{it.done ? "✅" : "⬜"}</span>
            <p style={{ fontSize: 12, color: it.done ? "var(--ah-text-tertiary)" : "var(--ah-text-primary)",
              textDecoration: it.done ? "line-through" : "none" }}>{it.label}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11.5, fontWeight: 600,
        color: r.allReady ? "var(--ah-score-excellent)" : "var(--ah-text-secondary)", lineHeight: 1.45 }}>
        {r.headline}
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(139,92,246,0.14), rgba(34,211,238,0.10))",
  border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-card)", padding: 14,
  display: "flex", flexDirection: "column", gap: 12,
};
const countdown: React.CSSProperties = {
  width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: "var(--ah-gradient-hero)",
  color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0,
};
