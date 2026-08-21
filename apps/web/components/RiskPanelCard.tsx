"use client";
import { useLiveQuery } from "dexie-react-hooks";
import {
  redFlagGuidance, DEFAULT_BIOMARKER_BANDS, fastingRukhsahNote,
  type BiomarkerClassification, type Zone, type Band,
} from "@arta/core";
import { db, type LocalBiomarkerReading } from "@/lib/db";
import { asClassification } from "@/lib/biomarker";
import { getActiveProfileId } from "@/lib/sync";
import { monitoredSet, setMonitored, CONDITION_META, type MonitoredCondition } from "@/lib/conditions";
import { featureBiomarkerV2, featureRamadan } from "@/lib/features";
import { isFastingToday } from "@/lib/fasting";
import { BiomarkerTrendChart, type TrendPoint } from "./BiomarkerTrendChart";

/** Biomarker & kondisi yang hanya tampil bila flag V2 aktif (lipid & asam urat). */
const V2_BIOMARKERS = new Set(["lipid", "uric_acid"]);
const V2_CONDITIONS = new Set<MonitoredCondition>(["dyslipidemia", "hyperuricemia"]);

/**
 * Risk Panel (Fase 2 · addendum §2.4) — TERPISAH dari Health Score. Empat
 * biomarker (TD, gula, lipid, asam urat) vs ambang guideline (deterministik),
 * tren pita-zona, kartu red-flag per kegawatan, dan pantauan proaktif.
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
const LIPID_PARAM_LABEL: Record<string, string> = {
  total_chol: "Total", ldl: "LDL", hdl: "HDL", tg: "TG",
};

const MARKERS: { biomarker: LocalBiomarkerReading["biomarker"]; condition: MonitoredCondition; icon: string; name: string }[] = [
  { biomarker: "bp", condition: "hypertension", icon: "🫀", name: "Tekanan Darah" },
  { biomarker: "glucose", condition: "diabetes", icon: "🩸", name: "Gula Darah" },
  { biomarker: "lipid", condition: "dyslipidemia", icon: "🧈", name: "Profil Lipid" },
  { biomarker: "uric_acid", condition: "hyperuricemia", icon: "🦴", name: "Asam Urat" },
];

const bandsFor = (biomarker: string, parameter: string, sex?: string): Band[] =>
  DEFAULT_BIOMARKER_BANDS.filter((b) => b.biomarker === biomarker && b.parameter === parameter && (!sex || b.sex === sex));

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
function formatMeasured(iso: string): string {
  const d = new Date(iso);
  return shortDate(iso) + " · " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function RiskPanelCard({ onLog }: { onLog: () => void }) {
  const rows = useLiveQuery(async () => {
    const profileId = await getActiveProfileId();
    const all = await db.biomarker_readings.orderBy("measuredAt").toArray();
    // hanya pembacaan profil aktif — data anggota keluarga (FM-2) tak bocor ke Risk Panel milik saya
    return all.filter((r) => !r.deletedAt && r.profileId === profileId);
  }, []);
  const monitored = useLiveQuery(() => monitoredSet(), []);
  // hari puasa → red-flag glukosa mendapat catatan rukhsah (§3.3); inert bila flag Ramadan mati
  const fasting = (useLiveQuery(() => isFastingToday(), []) ?? false) && featureRamadan();

  if (rows === undefined || monitored === undefined) return null;

  // V2 (lipid & asam urat) hanya bila flag V2 aktif — ambangnya direview terpisah.
  const activeMarkers = featureBiomarkerV2() ? MARKERS : MARKERS.filter((m) => !V2_BIOMARKERS.has(m.biomarker));

  const grouped = new Map<string, LocalBiomarkerReading[]>();
  for (const r of rows) (grouped.get(r.biomarker) ?? grouped.set(r.biomarker, []).get(r.biomarker)!).push(r);

  const shown = activeMarkers.filter((m) => grouped.has(m.biomarker) || monitored.has(m.condition));
  const redFlags: BiomarkerClassification[] = [];
  for (const m of activeMarkers) {
    const cls = asClassification(grouped.get(m.biomarker)?.at(-1)?.classification);
    if (cls?.redFlag && cls.redFlagReason) redFlags.push(cls);
  }
  const guidelineRef = shown
    .map((m) => asClassification(grouped.get(m.biomarker)?.at(-1)?.classification)?.guidelineRef)
    .find(Boolean);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🩺 Panel Risiko</p>
        <button onClick={onLog} style={addBtn}>+ Ukur</button>
      </div>

      {shown.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
          Pantau biomarker untuk deteksi dini. Pilih yang ingin Anda pantau di bawah, atau langsung catat hasil ukur.
        </p>
      ) : (
        <>
          {redFlags.map((c) => <RedFlagBanner key={c.redFlagReason} classification={c} fasting={fasting} />)}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((mk) => {
              const list = grouped.get(mk.biomarker) ?? [];
              const latest = list.at(-1) ?? null;
              const cls = latest ? asClassification(latest.classification) : null;
              if (!latest || !cls) {
                return <NudgeRow key={mk.biomarker} icon={mk.icon} name={mk.name} hint={CONDITION_META[mk.condition].hint} onLog={onLog} />;
              }
              return (
                <div key={mk.biomarker} style={marker}>
                  {mk.biomarker === "lipid"
                    ? <LipidRow icon={mk.icon} name={mk.name} classification={cls} sub={formatMeasured(latest.measuredAt)} />
                    : (
                      <>
                        <MarkerRow icon={mk.icon} name={markerName(mk, latest)} value={displayValue(mk.biomarker, latest)} unit={cls.band.unit} classification={cls} sub={formatMeasured(latest.measuredAt)} />
                        <Trend biomarker={mk.biomarker} list={list} latest={latest} unit={cls.band.unit} />
                      </>
                    )}
                </div>
              );
            })}
          </div>

          {guidelineRef && (
            <p style={disclaimer}>
              Klasifikasi mengikuti {guidelineRef} (dan pedoman terkait). Ini skrining, bukan diagnosis — konfirmasikan ke tenaga medis.
            </p>
          )}
        </>
      )}

      <ConditionChooser monitored={monitored} />
    </div>
  );
}

function markerName(mk: { biomarker: string; name: string }, latest: LocalBiomarkerReading): string {
  if (mk.biomarker === "glucose" && latest.context) return `${mk.name} · ${GLUCOSE_CONTEXT_LABEL[latest.context] ?? ""}`;
  return mk.name;
}
function displayValue(biomarker: string, latest: LocalBiomarkerReading): string {
  if (biomarker === "bp") return `${latest.values.systolic}/${latest.values.diastolic}`;
  return `${latest.values.value}`;
}

function Trend({ biomarker, list, latest, unit }: { biomarker: string; list: LocalBiomarkerReading[]; latest: LocalBiomarkerReading; unit: string }) {
  let points: TrendPoint[] = [];
  let bands: Band[] = [];
  let caption = "";
  if (biomarker === "bp") {
    points = list.map((r) => ({ value: r.values.systolic!, label: shortDate(r.measuredAt) }));
    bands = bandsFor("bp", "systolic");
    caption = "Tren sistolik";
  } else if (biomarker === "glucose") {
    const ctx = latest.context ?? "gds";
    points = list.filter((r) => r.context === ctx).map((r) => ({ value: r.values.value!, label: shortDate(r.measuredAt) }));
    bands = bandsFor("glucose", ctx);
    caption = `Tren ${GLUCOSE_CONTEXT_LABEL[ctx] ?? ""}`;
  } else if (biomarker === "uric_acid") {
    const sex = latest.context ?? "male"; // sex disimpan di context
    points = list.filter((r) => r.context === sex).map((r) => ({ value: r.values.value!, label: shortDate(r.measuredAt) }));
    bands = bandsFor("uric_acid", "uric_acid", sex);
    caption = "Tren asam urat";
  }
  return <BiomarkerTrendChart points={points} bands={bands} unit={unit} caption={caption} />;
}

function LipidRow({ icon, name, classification, sub }: { icon: string; name: string; classification: BiomarkerClassification; sub: string }) {
  const color = ZONE_COLOR[classification.zone];
  const breakdown = classification.components
    .map((c) => `${LIPID_PARAM_LABEL[c.parameter] ?? c.parameter} ${c.value}`)
    .join(" · ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 20 }} aria-hidden>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ah-text-primary)" }}>{name}</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>{breakdown}</p>
        <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)" }}>{sub}</p>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color, whiteSpace: "nowrap" }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        {classification.band.label}
      </span>
    </div>
  );
}

function ConditionChooser({ monitored }: { monitored: Set<string> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--ah-border)", paddingTop: 10 }}>
      <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Pantau:</span>
      {(Object.keys(CONDITION_META) as MonitoredCondition[])
        .filter((cond) => featureBiomarkerV2() || !V2_CONDITIONS.has(cond))
        .map((cond) => {
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

function RedFlagBanner({ classification, fasting }: { classification: BiomarkerClassification; fasting: boolean }) {
  const g = redFlagGuidance(classification.redFlagReason!);
  const rukhsah = fastingRukhsahNote(classification.redFlagReason, fasting);
  return (
    <div role="alert" style={redFlagBox}>
      <p style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>⚠️ {g.title}</p>
      <p style={{ fontSize: 12, color: "#fff", lineHeight: 1.5, opacity: 0.95 }}>{g.action}</p>
      {rukhsah && (
        <p style={{ fontSize: 12, color: "#fff", lineHeight: 1.5, opacity: 0.95, borderTop: "1px solid rgba(255,255,255,0.25)", paddingTop: 6 }}>
          🌙 {rukhsah}
        </p>
      )}
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
