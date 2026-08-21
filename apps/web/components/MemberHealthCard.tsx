"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import { redFlagGuidance, type BiomarkerInput, type BiomarkerClassification, type Zone } from "@arta/core";
import type { LocalBiomarkerReading } from "@/lib/db";
import { logMemberBiomarker, memberReadings, removeMemberReading } from "@/lib/family-health";

/**
 * Pantau biomarker satu anggota (Fase 6 · FM-2). Catat tensi/gula/asam urat untuk
 * anggota + lihat riwayat + zona. Lokal-first (sync anggota = FM-3). Kasus caregiver:
 * "anak mencatat tensi ibu". Di dalam FamilyCard, di balik flag NEXT_PUBLIC_FEATURE_FAMILY.
 */

const ZONE_COLOR: Record<Zone, string> = {
  green: "var(--ah-score-excellent)", yellow: "var(--ah-score-fair)", orange: "#FB923C", red: "var(--ah-score-low)",
};
const BM_LABEL: Record<string, string> = { bp: "Tensi", glucose: "Gula darah", lipid: "Lipid", uric_acid: "Asam urat" };
const num = (s: string): number | undefined => { const v = parseFloat(s.replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : undefined; };
const cls = (r: LocalBiomarkerReading) => r.classification as BiomarkerClassification | null;

export function MemberHealthCard({ memberId, name, sex }: { memberId: string; name: string; sex: "male" | "female" | null }) {
  const { show } = useToast();
  const readings = useLiveQuery(() => memberReadings(memberId), [memberId]) ?? [];
  const [sys, setSys] = useState(""); const [dia, setDia] = useState("");
  const [gdp, setGdp] = useState(""); const [uric, setUric] = useState("");

  const latest: Partial<Record<string, LocalBiomarkerReading>> = {};
  for (const r of readings) if (!latest[r.biomarker]) latest[r.biomarker] = r;
  // alert caregiver: red-flag (kegawatan) atau zona merah pada pembacaan terbaru
  const flagged = Object.values(latest).map((r) => cls(r!)).filter((c): c is BiomarkerClassification => !!c);
  const redFlag = flagged.find((c) => c.redFlag);
  const redConcerns = flagged.filter((c) => !c.redFlag && c.zone === "red");

  const save = async () => {
    const inputs: BiomarkerInput[] = [];
    const s = num(sys), d = num(dia);
    if (s && d) inputs.push({ biomarker: "bp", systolic: s, diastolic: d });
    const g = num(gdp); if (g) inputs.push({ biomarker: "glucose", context: "gdp", value: g });
    const u = num(uric); if (u) inputs.push({ biomarker: "uric_acid", value: u, sex: sex ?? "male" });
    if (inputs.length === 0) { show({ variant: "info", message: "Isi minimal satu nilai." }); return; }
    for (const inp of inputs) await logMemberBiomarker(memberId, inp);
    setSys(""); setDia(""); setGdp(""); setUric("");
    show({ message: `${inputs.length} nilai dicatat untuk ${name}` });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: 12 }}>
      {(redFlag || redConcerns.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "rgba(248,113,113,0.14)", border: "1.5px solid var(--ah-score-low)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px" }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "var(--ah-text-primary)" }}>
            {redFlag ? `⚠️ ${redFlagGuidance(redFlag.redFlagReason!).title}` : `⚠️ ${name} perlu perhatian`}
          </p>
          <p style={{ fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
            {redFlag ? redFlagGuidance(redFlag.redFlagReason!).action
              : `${redConcerns.map((c) => c.band.label).join(", ")} — jadwalkan pemeriksaan ke dokter untuk konfirmasi.`}
          </p>
        </div>
      )}
      {/* ringkasan terbaru */}
      {Object.keys(latest).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.values(latest).map((r) => {
            const c = cls(r!);
            return (
              <span key={r!.biomarker} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--ah-text-primary)", background: "var(--ah-surface-1)", borderRadius: "var(--ah-r-full)", padding: "5px 10px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: c ? ZONE_COLOR[c.zone] : "var(--ah-text-tertiary)" }} />
                {BM_LABEL[r!.biomarker] ?? r!.biomarker} {c?.band.label ?? ""}
              </span>
            );
          })}
        </div>
      )}

      {/* catat cepat */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={sys} onChange={(e) => setSys(e.target.value)} inputMode="numeric" placeholder="Sistol" style={input} />
          <span style={{ color: "var(--ah-text-tertiary)" }}>/</span>
          <input value={dia} onChange={(e) => setDia(e.target.value)} inputMode="numeric" placeholder="Diastol" style={input} />
        </div>
        <Field label="GDP" unit="mg/dL" value={gdp} onChange={setGdp} />
        <Field label="Asam urat" unit="mg/dL" value={uric} onChange={setUric} />
      </div>
      <button onClick={() => void save()} style={primaryBtn}>Catat untuk {name}</button>

      {/* riwayat */}
      {readings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--ah-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 }}>Riwayat</p>
          {readings.slice(0, 6).map((r) => {
            const c = cls(r);
            const val = r.biomarker === "bp" ? `${r.values.systolic}/${r.values.diastolic}` : Object.values(r.values)[0];
            return (
              <div key={r.clientId} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--ah-text-secondary)" }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c ? ZONE_COLOR[c.zone] : "var(--ah-text-tertiary)", marginRight: 6 }} />
                  {BM_LABEL[r.biomarker] ?? r.biomarker}: {val} · {new Date(r.measuredAt).toLocaleDateString("id")}
                </span>
                <button onClick={() => void removeMemberReading(r.clientId)} aria-label="Hapus" style={{ border: "none", background: "transparent", color: "var(--ah-text-tertiary)", cursor: "pointer", fontSize: 13 }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, unit, value, onChange }: { label: string; unit: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10, color: "var(--ah-text-tertiary)" }}>{label} <span style={{ opacity: 0.6 }}>({unit})</span></span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="—" style={input} />
    </label>
  );
}

const input: React.CSSProperties = {
  minHeight: 40, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 10px", fontSize: 14, width: "100%",
};
const primaryBtn: React.CSSProperties = {
  minHeight: 40, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
