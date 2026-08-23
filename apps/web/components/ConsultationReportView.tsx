"use client";
import type { ConsultationReport } from "@arta/core";

/**
 * Tampilan presentasional laporan konsultasi — dipakai kartu (ConsultationReportCard)
 * DAN halaman publik read-only /r/[token]. Murni render dari struktur ConsultationReport.
 */

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
const SEX_LABEL = { male: "Pria", female: "Wanita" } as const;
const DIR = { rising: "↑ naik", falling: "↓ turun", flat: "→ stabil", na: "" } as const;

export function ConsultationReportView({ report }: { report: ConsultationReport }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Kop — identitas ArtaHealth ringan */}
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
          Belum ada data cukup dalam rentang ini.
        </p>
      )}

      {report.sections.includes("biomarkers") && (
        <Section title="Biomarker & tren">
          {report.biomarkers.map((b) => (
            <div key={b.key} style={rowLine}>
              <span style={{ fontWeight: 700 }}>{b.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                {b.latestValue} {b.unit}
                {b.zoneLabel ? ` · ${b.zoneLabel}` : ""}
                {b.summary && b.summary.count > 1 && b.summary.direction !== "na"
                  ? ` · ${DIR[b.summary.direction]} (${b.summary.count}×)` : ""}
              </span>
            </div>
          ))}
          {report.biomarkers.some((b) => b.guidelineRef) && (
            <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
              Rujukan: {[...new Set(report.biomarkers.map((b) => b.guidelineRef).filter(Boolean))].join(" · ")}
            </p>
          )}
        </Section>
      )}

      {report.sections.includes("warnings") && (
        <Section title="Deteksi dini (geseran dari baseline)">
          {report.warnings.map((w, i) => (
            <p key={i} style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.4 }}>
              • {w.text}
            </p>
          ))}
        </Section>
      )}

      {report.sections.includes("medications") && (
        <Section title="Obat">
          {report.medications.map((m, i) => (
            <div key={i} style={rowLine}>
              <span style={{ fontWeight: 700 }}>{m.name}</span>
              <span style={{ color: "var(--ah-text-tertiary)", textAlign: "right" }}>
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

const rowLine: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12,
  color: "var(--ah-text-primary)", padding: "3px 0",
};
