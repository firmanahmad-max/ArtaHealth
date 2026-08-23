"use client";
import { useState } from "react";
import type { ConsultationReport } from "@arta/core";
import { consultationReport } from "@/lib/consultation";

/**
 * Mode Konsultasi — Laporan Dokter (V3-1 · MK-1). Rangkum data yang sudah dicatat
 * (90 hari) jadi laporan rapi untuk dibawa ke dokter — on-screen + cetak, on-device,
 * non-diagnosis. Berbagi via QR/link menyusul (MK-2). Flag NEXT_PUBLIC_FEATURE_CONSULTATION.
 */

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
const SEX_LABEL = { male: "Pria", female: "Wanita" } as const;
const DIR = { rising: "↑ naik", falling: "↓ turun", flat: "→ stabil", na: "" } as const;

export function ConsultationReportCard() {
  const [report, setReport] = useState<ConsultationReport | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try { setReport(await consultationReport()); }
    finally { setLoading(false); }
  };

  return (
    <div style={card} className="ah-consult">
      <style>{`@media print{body *{visibility:hidden}.ah-consult,.ah-consult *{visibility:visible}.ah-consult{position:absolute;left:0;top:0;width:100%;border:none}.ah-noprint{display:none!important}}`}</style>

      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🩺 Mode Konsultasi</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Ringkasan 90 hari untuk dibawa ke dokter. Dibuat di perangkatmu — bukan diagnosis.
        </p>
      </div>

      {!report && (
        <button onClick={() => void generate()} disabled={loading} style={primaryBtn} className="ah-noprint">
          {loading ? "Menyiapkan…" : "Buat laporan konsultasi"}
        </button>
      )}

      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Kop */}
          <div style={{ borderBottom: "1px solid var(--ah-border)", paddingBottom: 8 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: "var(--ah-text-primary)" }}>Ringkasan Kesehatan</p>
            <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)" }}>
              via ArtaHealth · {fmtDate(report.range.fromISO)} – {fmtDate(report.range.toISO)} · dibuat {fmtDate(report.generatedAtISO)}
            </p>
            <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", marginTop: 6 }}>
              <b>{report.patient.name ?? "Pengguna"}</b>
              {report.patient.age != null && ` · ${report.patient.age} th`}
              {report.patient.sex && ` · ${SEX_LABEL[report.patient.sex]}`}
              {report.patient.conditions.length > 0 && ` · Dipantau: ${report.patient.conditions.join(", ")}`}
            </p>
          </div>

          {report.isEmpty && (
            <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>
              Belum ada data cukup dalam 90 hari terakhir. Catat biomarker/aktivitas dulu, lalu buat lagi.
            </p>
          )}

          {report.sections.includes("biomarkers") && (
            <Section title="Biomarker & tren">
              {report.biomarkers.map((b) => (
                <div key={b.key} style={rowLine}>
                  <span style={{ fontWeight: 700 }}>{b.label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {b.latestValue} {b.unit}
                    {b.zoneLabel ? ` · ${b.zoneLabel}` : ""}
                    {b.summary && b.summary.count > 1 && b.summary.direction !== "na"
                      ? ` · ${DIR[b.summary.direction]} (${b.summary.count}×)` : ""}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {report.sections.includes("warnings") && (
            <Section title="Deteksi dini (geseran dari baseline)">
              {report.warnings.map((w, i) => (
                <p key={i} style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.4 }}>
                  • <b>{w.label}</b> — {w.text}
                </p>
              ))}
            </Section>
          )}

          {report.sections.includes("medications") && (
            <Section title="Obat">
              {report.medications.map((m, i) => (
                <div key={i} style={rowLine}>
                  <span style={{ fontWeight: 700 }}>{m.name}</span>
                  <span style={{ color: "var(--ah-text-tertiary)" }}>
                    {m.schedule || "—"}{m.adherencePct != null ? ` · patuh ${m.adherencePct}%` : ""}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {report.sections.includes("lifestyle") && report.lifestyle && (
            <Section title="Gaya hidup (rata-rata)">
              <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)" }}>
                {report.lifestyle.sleepAvgH != null && `Tidur ~${report.lifestyle.sleepAvgH} jam/malam. `}
                {report.lifestyle.hydrationAvgMl != null && `Hidrasi ~${report.lifestyle.hydrationAvgMl} ml/hari. `}
                {report.lifestyle.activityAvgMin != null && `Aktivitas ~${report.lifestyle.activityAvgMin} mnt/sesi.`}
              </p>
            </Section>
          )}

          {report.sections.includes("nutrition") && report.nutrition && (
            <Section title="Gizi (rata-rata harian)">
              <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)" }}>
                {report.nutrition.sodiumAvgMg != null && `Natrium ~${report.nutrition.sodiumAvgMg} mg/hari. `}
                {report.nutrition.sugarAvgG != null && `Gula ~${report.nutrition.sugarAvgG} g/hari.`}
              </p>
            </Section>
          )}

          {report.sections.includes("documents") && (
            <Section title="Dokumen lab tersimpan">
              {report.documents.map((d, i) => (
                <div key={i} style={rowLine}>
                  <span>{d.title}</span><span style={{ color: "var(--ah-text-tertiary)" }}>{fmtDate(d.dateISO)}</span>
                </div>
              ))}
            </Section>
          )}

          <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)", lineHeight: 1.5, borderTop: "1px solid var(--ah-border)", paddingTop: 8 }}>
            {report.disclaimer}
          </p>

          <div style={{ display: "flex", gap: 8 }} className="ah-noprint">
            <button onClick={() => window.print()} style={primaryBtn}>🖨️ Cetak / simpan PDF</button>
            <button onClick={() => setReport(null)} style={ghostBtn}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: "var(--ah-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.3 }}>{title}</p>
      {children}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const rowLine: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12,
  color: "var(--ah-text-primary)", padding: "3px 0",
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, flex: 1, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
