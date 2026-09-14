"use client";
import { useEffect, useState } from "react";
import type { AqiCategory } from "@arta/core";
import { fetchAirQuality, type AqResult } from "@/lib/air-quality";

/**
 * Radar Sehat (backlog) — kualitas udara (AQI) lokasi pengguna via Open-Meteo + saran
 * tindakan. Non-medis (kesadaran lingkungan). Flag NEXT_PUBLIC_FEATURE_RADAR.
 * (heat/DBD = follow-up.)
 */

const TONE: Record<"good" | "warn" | "bad" | "neutral", { color: string; bg: string }> = {
  good: { color: "var(--ah-score-excellent)", bg: "rgba(52,211,153,0.12)" },
  warn: { color: "#FB923C", bg: "rgba(251,146,60,0.12)" },
  bad: { color: "var(--ah-score-low)", bg: "rgba(248,113,113,0.14)" },
  neutral: { color: "var(--ah-text-secondary)", bg: "var(--ah-surface-2)" },
};
const CAT_ICON: Record<AqiCategory, string> = {
  good: "🟢", moderate: "🟡", sensitive: "🟠", unhealthy: "🔴", very_unhealthy: "🟣", hazardous: "🟤",
};

export function RadarSehatCard() {
  const [state, setState] = useState<{ loading: boolean; result: AqResult | null }>({ loading: true, result: null });

  const load = () => {
    setState({ loading: true, result: null });
    void fetchAirQuality().then((result) => setState({ loading: false, result }));
  };
  useEffect(() => { load(); }, []);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌫️ Radar Sehat — Udara</p>
          <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>Kualitas udara di lokasimu · sumber Open-Meteo.</p>
        </div>
        <button onClick={load} style={ghostBtn} aria-label="Perbarui">↻</button>
      </div>

      {state.loading && <p style={{ fontSize: 12, color: "var(--ah-text-secondary)" }}>Memuat kualitas udara…</p>}

      {!state.loading && state.result && !state.result.ok && (
        <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>{state.result.message}</p>
      )}

      {!state.loading && state.result?.ok && (() => {
        const r = state.result.reading;
        const t = TONE[r.info.tone];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ ...aqiBadge, borderColor: t.color, background: t.bg }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1 }}>{r.usAqi}</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--ah-text-tertiary)" }}>US AQI</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{CAT_ICON[r.info.category]} {r.info.label}</p>
                <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
                  Rentang {r.info.range}
                  {(r.pm25 != null || r.pm10 != null) && " · "}
                  {r.pm25 != null && `PM2.5 ${Math.round(r.pm25)} µg/m³`}
                  {r.pm25 != null && r.pm10 != null && " · "}
                  {r.pm10 != null && `PM10 ${Math.round(r.pm10)}`}
                </p>
              </div>
            </div>

            <div style={{ ...adviceBox, background: t.bg, border: `1px solid ${t.color}` }}>
              <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.45 }}>{r.info.advice}</p>
            </div>

            {r.approxLocation && (
              <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)" }}>📍 Lokasi perkiraan (Jakarta) — izinkan lokasi untuk data akurat.</p>
            )}
          </div>
        );
      })()}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Informasi lingkungan umum untuk kesadaran diri, bukan nasihat medis. Kelompok sensitif ikuti anjuran tenaga kesehatan.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const aqiBadge: React.CSSProperties = {
  width: 60, height: 60, borderRadius: "50%", flexShrink: 0, border: "2px solid",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
};
const adviceBox: React.CSSProperties = { borderRadius: "var(--ah-r-inner)", padding: "10px 12px" };
const ghostBtn: React.CSSProperties = {
  minWidth: 36, minHeight: 36, borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 16, fontWeight: 700, cursor: "pointer",
};
