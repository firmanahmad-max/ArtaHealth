"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { earlyWarningReport, type EarlyWarning } from "@/lib/early-warning";
import { db } from "@/lib/db";

/**
 * Early Warning (Fase 6 · EW). Menandai geseran metrik terhadap baseline PRIBADI
 * (z-score deterministik) — "ada yang bergeser untukmu", walau masih dalam rentang
 * normal. Bukan diagnosis. Diam saat data belum cukup. Di balik flag
 * NEXT_PUBLIC_FEATURE_EARLY_WARNING.
 */

const SEVERITY: Record<string, { color: string; label: string; bg: string }> = {
  alert: { color: "var(--ah-score-low)", label: "Waspada", bg: "rgba(248,113,113,0.14)" },
  watch: { color: "#FB923C", label: "Perhatikan", bg: "rgba(251,146,60,0.12)" },
};

function WarningRow({ w }: { w: EarlyWarning }) {
  const s = SEVERITY[w.result.severity] ?? SEVERITY.watch;
  const arrow = w.result.direction === "rising" ? "↑" : w.result.direction === "falling" ? "↓" : "→";
  const rm = w.result.recentMean;
  const bm = w.result.baseline?.mean;
  return (
    <div style={{ display: "flex", gap: 10, background: s!.bg, border: `1.5px solid ${s!.color}`, borderRadius: "var(--ah-r-inner)", padding: "10px 12px" }}>
      <span style={{ fontSize: 18 }}>{w.metric.icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ah-text-primary)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {w.metric.label}
          <span style={{ fontSize: 10, fontWeight: 800, color: s!.color, border: `1px solid ${s!.color}`, borderRadius: "var(--ah-r-full)", padding: "1px 7px" }}>{s!.label}</span>
        </p>
        <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.45, marginTop: 2 }}>{w.message}</p>
        {rm != null && bm != null && (
          <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
            {arrow} terkini ~{rm.toFixed(1)} {w.metric.unit} vs biasanya ~{bm.toFixed(1)} {w.metric.unit}
            {w.result.z != null && ` · z=${w.result.z.toFixed(1)}`}
          </p>
        )}
      </div>
    </div>
  );
}

export function EarlyWarningCard() {
  // liveQuery menonton tabel sumber → laporan ikut segar saat ada catatan baru.
  const dep = useLiveQuery(async () => {
    const c = await Promise.all([
      db.weight_logs.count(), db.sleep_logs.count(), db.biomarker_readings.count(),
    ]);
    return c.join(",");
  }, []);
  const report = useLiveQuery(() => earlyWarningReport(), [dep]);

  // Sembunyikan kartu total bila tak ada apa pun untuk ditampilkan (tak menambah noise).
  if (!report || (report.warnings.length === 0 && report.monitoring.length === 0)) return null;

  const { warnings, monitoring } = report;

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🔭 Deteksi Dini</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Perubahan tren dibanding <b>kebiasaanmu sendiri</b> — bukan diagnosis, sekadar sinyal untuk dicek.
        </p>
      </div>

      {warnings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {warnings.map((w) => <WarningRow key={w.metric.key} w={w} />)}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(52,211,153,0.10)", border: "1px solid var(--ah-score-excellent)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px" }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.4 }}>Tak ada geseran mencurigakan dari baseline-mu saat ini.</p>
        </div>
      )}

      {monitoring.length > 0 && (
        <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
          📈 Sedang membangun baseline: {monitoring.map((m) => `${m.metric.label} (${m.baselineN}/${m.needed})`).join(" · ")}. Catat rutin agar deteksi lebih akurat.
        </p>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Arta bukan pengganti tenaga medis. Sinyal ini edukasi umum berbasis pola datamu, bukan diagnosis.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
