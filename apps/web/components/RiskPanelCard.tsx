"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { redFlagGuidance, type BiomarkerClassification, type Zone } from "@arta/core";
import { db } from "@/lib/db";
import { asClassification } from "@/lib/biomarker";

/**
 * Risk Panel (Fase 2 · addendum §2.4) — TERPISAH dari Health Score.
 * Menampilkan klasifikasi tekanan darah & gula darah terbaru terhadap ambang
 * guideline (deterministik), dengan kartu red-flag saat ada kegawatan.
 * Alat edukasi/skrining — BUKAN diagnosis. Dirender hanya di balik feature flag.
 */

const ZONE_COLOR: Record<Zone, string> = {
  green: "var(--ah-score-excellent)",
  yellow: "var(--ah-score-fair)",
  orange: "#FB923C",
  red: "var(--ah-score-low)",
};

const GLUCOSE_CONTEXT_LABEL: Record<string, string> = {
  gdp: "Puasa", gds: "Sewaktu", pp2: "2 jam", hba1c: "HbA1c",
};

function formatMeasured(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function RiskPanelCard({ onLog }: { onLog: () => void }) {
  const latestBp = useLiveQuery(async () => {
    const rows = await db.biomarker_readings.where("[biomarker+measuredAt]")
      .between(["bp", ""], ["bp", "￿"]).reverse().toArray();
    return rows.find((r) => !r.deletedAt) ?? null;
  }, []);
  const latestGlucose = useLiveQuery(async () => {
    const rows = await db.biomarker_readings.where("[biomarker+measuredAt]")
      .between(["glucose", ""], ["glucose", "￿"]).reverse().toArray();
    return rows.find((r) => !r.deletedAt) ?? null;
  }, []);

  // undefined = masih memuat; null = tak ada data
  if (latestBp === undefined || latestGlucose === undefined) return null;

  const bpClass = latestBp ? asClassification(latestBp.classification) : null;
  const glucoseClass = latestGlucose ? asClassification(latestGlucose.classification) : null;
  const redFlag = [bpClass, glucoseClass].find((c) => c?.redFlag) ?? null;

  const empty = !latestBp && !latestGlucose;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🩺 Panel Risiko</p>
        <button onClick={onLog} style={addBtn}>+ Ukur</button>
      </div>

      {empty ? (
        <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
          Pantau tekanan darah &amp; gula darah untuk deteksi dini. Catat hasil ukur pertama Anda.
        </p>
      ) : (
        <>
          {redFlag?.redFlagReason && <RedFlagBanner classification={redFlag} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {latestBp && bpClass && (
              <MarkerRow
                icon="🫀" name="Tekanan Darah"
                value={`${latestBp.values.systolic}/${latestBp.values.diastolic}`}
                unit="mmHg"
                classification={bpClass}
                sub={formatMeasured(latestBp.measuredAt)}
              />
            )}
            {latestGlucose && glucoseClass && (
              <MarkerRow
                icon="🩸" name={`Gula Darah${latestGlucose.context ? ` · ${GLUCOSE_CONTEXT_LABEL[latestGlucose.context] ?? ""}` : ""}`}
                value={`${latestGlucose.values.value}`}
                unit={glucoseClass.band.unit}
                classification={glucoseClass}
                sub={formatMeasured(latestGlucose.measuredAt)}
              />
            )}
          </div>
          <p style={disclaimer}>
            Klasifikasi mengikuti {bpClass?.guidelineRef ?? glucoseClass?.guidelineRef}. Ini skrining, bukan
            diagnosis — konfirmasikan ke tenaga medis.
          </p>
        </>
      )}
    </div>
  );
}

function MarkerRow({ icon, name, value, unit, classification, sub }: {
  icon: string; name: string; value: string; unit: string;
  classification: BiomarkerClassification; sub: string;
}) {
  const color = ZONE_COLOR[classification.zone];
  return (
    <div style={row}>
      <span style={{ fontSize: 20 }} aria-hidden>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ah-text-primary)" }}>{name}</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>{sub}</p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: "var(--ah-text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {value} <span style={{ fontSize: 10, fontWeight: 500, color: "var(--ah-text-tertiary)" }}>{unit}</span>
        </p>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
          {classification.band.label}
        </span>
      </div>
    </div>
  );
}

function RedFlagBanner({ classification }: { classification: BiomarkerClassification }) {
  const g = redFlagGuidance(classification.redFlagReason!);
  return (
    <div role="alert" style={redFlagBox}>
      <p style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>⚠️ {g.title}</p>
      <p style={{ fontSize: 12, color: "#fff", lineHeight: 1.5, opacity: 0.95 }}>{g.action}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
};
const addBtn: React.CSSProperties = {
  minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const redFlagBox: React.CSSProperties = {
  background: "var(--ah-score-low)", borderRadius: "var(--ah-r-inner)", padding: 12,
  display: "flex", flexDirection: "column", gap: 4,
};
const disclaimer: React.CSSProperties = {
  fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5,
};
