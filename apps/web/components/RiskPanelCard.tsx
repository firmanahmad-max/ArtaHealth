"use client";
import { useLiveQuery } from "dexie-react-hooks";
import {
  redFlagGuidance, DEFAULT_BIOMARKER_BANDS,
  type BiomarkerClassification, type Zone, type Band,
} from "@arta/core";
import { db, type LocalBiomarkerReading } from "@/lib/db";
import { asClassification } from "@/lib/biomarker";
import { monitoredSet, setMonitored, CONDITION_META } from "@/lib/conditions";
import { BiomarkerTrendChart, type TrendPoint } from "./BiomarkerTrendChart";

/**
 * Risk Panel (Fase 2 · addendum §2.4) — TERPISAH dari Health Score.
 * Klasifikasi TD & gula darah terbaru vs ambang guideline (deterministik) + tren
 * pita-zona + kartu red-flag untuk SETIAP kegawatan. Menyatakan kondisi yang
 * dipantau membuat panel proaktif (baris muncul walau belum ada data).
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

const bandsFor = (biomarker: string, parameter: string): Band[] =>
  DEFAULT_BIOMARKER_BANDS.filter((b) => b.biomarker === biomarker && b.parameter === parameter);

function formatMeasured(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

const history = async (biomarker: "bp" | "glucose"): Promise<LocalBiomarkerReading[]> => {
  const rows = await db.biomarker_readings.where("[biomarker+measuredAt]")
    .between([biomarker, ""], [biomarker, "￿"]).toArray();
  return rows.filter((r) => !r.deletedAt);
};

export function RiskPanelCard({ onLog }: { onLog: () => void }) {
  const bpRows = useLiveQuery(() => history("bp"), []);
  const glucoseRows = useLiveQuery(() => history("glucose"), []);
  const monitored = useLiveQuery(() => monitoredSet(), []);

  if (bpRows === undefined || glucoseRows === undefined || monitored === undefined) return null;

  const latestBp = bpRows.at(-1) ?? null;
  const latestGlucose = glucoseRows.at(-1) ?? null;
  const bpClass = latestBp ? asClassification(latestBp.classification) : null;
  const glucoseClass = latestGlucose ? asClassification(latestGlucose.classification) : null;

  const redFlags = [bpClass, glucoseClass].filter(
    (c): c is BiomarkerClassification => !!c?.redFlag && !!c.redFlagReason,
  );

  const bpMonitored = monitored.has("hypertension");
  const glucoseMonitored = monitored.has("diabetes");
  const showBp = !!latestBp || bpMonitored;
  const showGlucose = !!latestGlucose || glucoseMonitored;
  const empty = !showBp && !showGlucose;
  const guidelineRef = bpClass?.guidelineRef ?? glucoseClass?.guidelineRef;

  const glucoseCtx = latestGlucose?.context ?? null;
  const glucoseTrend: TrendPoint[] = glucoseCtx
    ? glucoseRows.filter((r) => r.context === glucoseCtx)
        .map((r) => ({ value: r.values.value!, label: shortDate(r.measuredAt) }))
    : [];
  const bpTrend: TrendPoint[] = bpRows.map((r) => ({ value: r.values.systolic!, label: shortDate(r.measuredAt) }));

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🩺 Panel Risiko</p>
        <button onClick={onLog} style={addBtn}>+ Ukur</button>
      </div>

      {empty ? (
        <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
          Pantau tekanan darah &amp; gula darah untuk deteksi dini. Pilih yang ingin Anda pantau di bawah, atau langsung catat hasil ukur.
        </p>
      ) : (
        <>
          {redFlags.map((c) => <RedFlagBanner key={c.redFlagReason} classification={c} />)}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {showBp && (latestBp && bpClass ? (
              <div style={marker}>
                <MarkerRow
                  icon="🫀" name="Tekanan Darah"
                  value={`${latestBp.values.systolic}/${latestBp.values.diastolic}`}
                  unit="mmHg" classification={bpClass} sub={formatMeasured(latestBp.measuredAt)}
                />
                <BiomarkerTrendChart points={bpTrend} bands={bandsFor("bp", "systolic")} unit="mmHg" caption="Tren sistolik" />
              </div>
            ) : (
              <NudgeRow icon="🫀" name="Tekanan Darah" hint={CONDITION_META.hypertension.hint} onLog={onLog} />
            ))}

            {showGlucose && (latestGlucose && glucoseClass && glucoseCtx ? (
              <div style={marker}>
                <MarkerRow
                  icon="🩸" name={`Gula Darah · ${GLUCOSE_CONTEXT_LABEL[glucoseCtx] ?? ""}`}
                  value={`${latestGlucose.values.value}`}
                  unit={glucoseClass.band.unit} classification={glucoseClass} sub={formatMeasured(latestGlucose.measuredAt)}
                />
                <BiomarkerTrendChart points={glucoseTrend} bands={bandsFor("glucose", glucoseCtx)} unit={glucoseClass.band.unit} caption={`Tren ${GLUCOSE_CONTEXT_LABEL[glucoseCtx] ?? ""}`} />
              </div>
            ) : (
              <NudgeRow icon="🩸" name="Gula Darah" hint={CONDITION_META.diabetes.hint} onLog={onLog} />
            ))}
          </div>

          {guidelineRef && (
            <p style={disclaimer}>
              Klasifikasi mengikuti {guidelineRef}. Ini skrining, bukan diagnosis — konfirmasikan ke tenaga medis.
            </p>
          )}
        </>
      )}

      <ConditionChooser monitored={monitored} />
    </div>
  );
}

function ConditionChooser({ monitored }: { monitored: Set<string> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--ah-border)", paddingTop: 10 }}>
      <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Pantau:</span>
      {(["hypertension", "diabetes"] as const).map((cond) => {
        const meta = CONDITION_META[cond];
        const on = monitored.has(cond);
        return (
          <button
            key={cond}
            onClick={() => void setMonitored(cond, !on)}
            aria-pressed={on}
            style={{
              minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
              border: on ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
              background: on ? "var(--ah-gradient-soft)" : "transparent",
              color: on ? "var(--ah-text-primary)" : "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600,
            }}
          >
            {on ? "✓ " : ""}{meta.icon} {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function NudgeRow({ icon, name, hint, onLog }: { icon: string; name: string; hint: string; onLog: () => void }) {
  return (
    <div style={{ ...marker, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 20 }} aria-hidden>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ah-text-primary)" }}>{name}</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Belum ada data — pantau dimulai</p>
      </div>
      <button onClick={onLog} style={nudgeBtn}>{hint}</button>
    </div>
  );
}

function MarkerRow({ icon, name, value, unit, classification, sub }: {
  icon: string; name: string; value: string; unit: string;
  classification: BiomarkerClassification; sub: string;
}) {
  const color = ZONE_COLOR[classification.zone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
const marker: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8,
  background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
};
const addBtn: React.CSSProperties = {
  minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const nudgeBtn: React.CSSProperties = {
  minHeight: 36, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
};
const redFlagBox: React.CSSProperties = {
  background: "var(--ah-score-low)", borderRadius: "var(--ah-r-inner)", padding: 12,
  display: "flex", flexDirection: "column", gap: 4,
};
const disclaimer: React.CSSProperties = {
  fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5,
};
