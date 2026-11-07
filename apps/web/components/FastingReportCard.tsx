"use client";
import { useEffect, useState } from "react";
import type { FastingReport, ValueStat, BpStat } from "@arta/core";
import { fastingReport, fastingReportAvailable } from "@/lib/fasting-report";
import { useMounted } from "@/lib/useMounted";
import { usePremium } from "@/lib/entitlement";
import { PremiumLocked } from "./PremiumLocked";
import { printOnly, printOnlyCss } from "@/lib/print";

/**
 * Laporan Puasa untuk dokter (Fase 9 · manfaat Paket Ramadan #2). Rekap selama Ramadan: hari
 * berpuasa, gula & tensi saat jam puasa vs di luar, hitungan ambang kegawatan, obat di jam puasa,
 * kepatuhan, berat badan. Cetak/simpan PDF lewat dialog cetak browser. On-device, non-diagnosis.
 * Flag NEXT_PUBLIC_FEATURE_FASTING_REPORT.
 */

const fmt = (k: string): string =>
  new Date(`${k}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export function FastingReportCard() {
  const mounted = useMounted();
  const [available, setAvailable] = useState(false);
  const [r, setR] = useState<FastingReport | null | undefined>(undefined); // undefined = belum dibuat
  const [loading, setLoading] = useState(false);
  const allowed = usePremium("fasting_report");

  useEffect(() => {
    if (!mounted) return;
    void fastingReportAvailable().then(setAvailable);
  }, [mounted]);

  if (!available || allowed === undefined) return null; // di luar musim / rentang belum diatur / belum mulai
  if (!allowed) {
    return <PremiumLocked title="Laporan Puasa untuk Dokter" desc="Rekap gula darah & tensi saat jam puasa, obat, dan berat badan selama Ramadan — siap dicetak/PDF." />;
  }

  const generate = async () => {
    setLoading(true);
    try { setR(await fastingReport()); } finally { setLoading(false); }
  };

  return (
    <div style={card} className="ah-fastrep">
      <style>{printOnlyCss("fastrep", "ah-fastrep", ";background:#fff!important") +
        `@media print{body[data-print=fastrep] .ah-fastrep *{color:#000!important}}`}</style>

      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🩺 Laporan Puasa untuk Dokter</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Rekap Ramadan: gula & tensi saat puasa, obat, berat badan. Dibuat di perangkatmu — bukan diagnosis.
        </p>
      </div>

      {r === undefined && (
        <button onClick={() => void generate()} disabled={loading} style={primaryBtn} className="ah-noprint">
          {loading ? "Menyiapkan…" : "Buat laporan puasa"}
        </button>
      )}

      {r === null && (
        <div className="ah-noprint" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>Laporan tersedia setelah Ramadan dimulai (atur tanggal Ramadan dulu).</p>
          <button onClick={() => setR(undefined)} style={ghostBtn}>Tutup</button>
        </div>
      )}

      {r && <ReportBody r={r} onClose={() => setR(undefined)} />}
    </div>
  );
}

function ReportBody({ r, onClose }: { r: FastingReport; onClose: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ borderBottom: "1px solid var(--ah-border)", paddingBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: "var(--ah-text-primary)" }}>Laporan Puasa Ramadan</p>
        <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)" }}>
          via ArtaHealth · {fmt(r.startDate)} – {fmt(r.endDate)} · dibuat {fmt(r.generatedAtISO.slice(0, 10))}
        </p>
        <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", marginTop: 6 }}>
          <b>{r.patientName ?? "Pengguna"}</b>
          {r.conditions.length > 0 && ` · Dipantau: ${r.conditions.join(", ")}`}
        </p>
      </div>

      <Section title="Hari puasa">
        <Row k="Berpuasa" v={`${r.days.fasted} dari ${r.days.total} hari`} />
        {r.days.notFasted > 0 && <Row k="Tidak berpuasa" v={`${r.days.notFasted} hari`} />}
      </Section>

      {r.discussionPoints.length > 0 && (
        <Section title="Poin untuk didiskusikan">
          {r.discussionPoints.map((p) => (
            <p key={p} style={{ fontSize: 11.5, color: "var(--ah-text-primary)", lineHeight: 1.45 }}>• {p}</p>
          ))}
        </Section>
      )}

      {r.glucose && (
        <Section title="Gula darah (mg/dL)">
          <StatRow label="Saat jam puasa" s={r.glucose.duringFast} />
          <StatRow label="Di luar jam puasa" s={r.glucose.outsideFast} />
        </Section>
      )}

      {r.bp && (
        <Section title="Tekanan darah (mmHg)">
          <BpRow label="Saat jam puasa" s={r.bp.duringFast} />
          <BpRow label="Di luar jam puasa" s={r.bp.outsideFast} />
        </Section>
      )}

      {r.medications.length > 0 && (
        <Section title="Obat">
          {r.medications.map((m) => (
            <Row key={m.name} k={m.name}
              v={`${m.times.join(", ") || "—"}${m.conflictTimes.length ? " ⚠ jam puasa" : ""}${m.adherencePct != null ? ` · patuh ${m.adherencePct}%` : ""}`} />
          ))}
        </Section>
      )}

      {r.weight && (
        <Section title="Berat badan">
          <Row k="Awal → akhir" v={`${r.weight.startKg} → ${r.weight.endKg} kg (${r.weight.deltaKg > 0 ? "+" : ""}${r.weight.deltaKg})`} />
        </Section>
      )}

      {!r.glucose && !r.bp && r.medications.length === 0 && !r.weight && (
        <p style={{ fontSize: 11.5, color: "var(--ah-text-tertiary)" }}>
          Belum ada catatan gula darah, tensi, obat, atau berat badan selama Ramadan ini.
        </p>
      )}

      <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)", lineHeight: 1.5, borderTop: "1px solid var(--ah-border)", paddingTop: 8 }}>
        {r.disclaimer}
      </p>

      <div style={{ display: "flex", gap: 8 }} className="ah-noprint">
        <button onClick={() => printOnly("fastrep")} style={primaryBtn}>🖨️ Cetak / PDF</button>
        <button onClick={onClose} style={ghostBtn}>Tutup</button>
      </div>
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
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={rowLine}>
      <span style={{ fontWeight: 700 }}>{k}</span>
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ah-text-secondary)" }}>{v}</span>
    </div>
  );
}
const StatRow = ({ label, s }: { label: string; s: ValueStat | null }) => (
  <Row k={label} v={s ? `rata-rata ${s.avg} · ${s.min}–${s.max} (${s.count}×)` : "—"} />
);
const BpRow = ({ label, s }: { label: string; s: BpStat | null }) => (
  <Row k={label} v={s ? `rata-rata ${s.avgSys}/${s.avgDia} · tertinggi ${s.maxSys}/${s.maxDia} (${s.count}×)` : "—"} />
);

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
  minHeight: 40, flex: 1, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
