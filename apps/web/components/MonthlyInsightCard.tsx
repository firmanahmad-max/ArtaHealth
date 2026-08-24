"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { describeCorrelation } from "@arta/core";
import { monthlyInsight } from "@/lib/correlation";
import { db } from "@/lib/db";

/**
 * Laporan Bulanan + korelasi lintas-metrik (V3-3). Rata-rata 30 hari + pola antar-metrik
 * (deterministik, POLA bukan sebab-akibat). Sembunyi bila belum ada data. Flag
 * NEXT_PUBLIC_FEATURE_MONTHLY.
 */

export function MonthlyInsightCard() {
  const dep = useLiveQuery(async () => {
    const c = await Promise.all([
      db.sleep_logs.count(), db.hydration_logs.count(), db.activity_logs.count(), db.mood_logs.count(),
    ]);
    return c.join(",");
  }, []);
  const insight = useLiveQuery(() => monthlyInsight(), [dep]);

  if (!insight || insight.metrics.length === 0) return null;

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>📅 Laporan Bulanan</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Rata-rata {insight.rangeDays} hari & pola antar-kebiasaanmu.
        </p>
      </div>

      {/* Rata-rata per metrik */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={sectionLabel}>Rata-rata</p>
        {insight.metrics.map((m) => (
          <div key={m.key} style={rowLine}>
            <span style={{ textTransform: "capitalize" }}>{m.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ah-text-secondary)" }}>
              {m.avg}{m.unit === "/5" ? m.unit : ` ${m.unit}`} <span style={{ color: "var(--ah-text-tertiary)" }}>· {m.days} hari</span>
            </span>
          </div>
        ))}
      </div>

      {/* Pola / korelasi */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={sectionLabel}>Pola yang terlihat</p>
        {insight.correlations.length > 0 ? (
          insight.correlations.map((c) => (
            <p key={`${c.a}-${c.b}`} style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.45 }}>
              • {describeCorrelation(c, insight.labels)}
            </p>
          ))
        ) : (
          <p style={{ fontSize: 11.5, color: "var(--ah-text-tertiary)", lineHeight: 1.45 }}>
            Belum ada pola cukup kuat. Catat rutin (≥8 hari beririsan) agar pola muncul.
          </p>
        )}
      </div>

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Pola = kecenderungan yang muncul bersamaan, <b>bukan sebab-akibat</b> & bukan diagnosis.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)" };
const rowLine: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "var(--ah-text-primary)", padding: "2px 0",
};
