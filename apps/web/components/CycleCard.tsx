"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PHASE_LABEL, CYCLE_DISCLAIMER, type CyclePhase } from "@arta/core";
import { addPeriod, removePeriod, periodLogs, cyclePrediction } from "@/lib/cycle";
import { db } from "@/lib/db";

/**
 * Kesehatan Siklus (V3-5). Catat tanggal mulai haid → prediksi siklus/fase/haid
 * berikutnya/jendela subur (deterministik, perkiraan). BUKAN alat kontrasepsi/diagnosis.
 * Flag NEXT_PUBLIC_FEATURE_CYCLE.
 */

const PHASE_COLOR: Record<CyclePhase, string> = {
  menstruation: "var(--ah-score-low)", fertile: "#F472B6", follicular: "var(--ah-cyan, #22D3EE)",
  luteal: "#A78BFA", late: "#FB923C", unknown: "var(--ah-text-tertiary)",
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const todayStr = () => new Date().toISOString().slice(0, 10);

export function CycleCard() {
  const [date, setDate] = useState(todayStr());
  const dep = useLiveQuery(() => db.cycle_logs.count(), []);
  const logs = useLiveQuery(() => periodLogs(), [dep]) ?? [];
  const pred = useLiveQuery(() => cyclePrediction(), [dep]);

  const phaseColor = pred ? PHASE_COLOR[pred.phase] : "var(--ah-text-tertiary)";

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌸 Kesehatan Siklus</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Perkiraan dari riwayat haidmu. Bukan alat kontrasepsi — sekadar bantu memahami pola.
        </p>
      </div>

      {pred && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ ...phaseBadge, borderColor: phaseColor }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ah-text-tertiary)", lineHeight: 1 }}>HARI</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1 }}>{pred.cycleDay}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: phaseColor }}>{PHASE_LABEL[pred.phase]}</p>
            <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)" }}>
              {pred.daysUntilNext >= 0
                ? `Perkiraan haid berikutnya ${fmt(pred.nextPeriodISO)} (${pred.daysUntilNext} hari lagi).`
                : `Perkiraan haid lewat ${Math.abs(pred.daysUntilNext)} hari — bila telat berlanjut, cek ke nakes.`}
            </p>
            <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
              Siklus ~{pred.cycleLength} hari{pred.regular ? " · teratur" : " · variasi tinggi"}
              {pred.fertileWindow ? ` · subur (perkiraan) ${fmt(pred.fertileWindow.startISO)}–${fmt(pred.fertileWindow.endISO)}` : ""}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 150 }}>
          <span style={miniLabel}>Tanggal mulai haid</span>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={input} />
        </label>
        <button onClick={() => date && void addPeriod(date)} style={primaryBtn}>+ Catat haid</button>
      </div>

      {logs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={miniLabel}>Riwayat ({logs.length})</p>
          {logs.slice(0, 6).map((l) => (
            <div key={l.id} style={row}>
              <span style={{ fontSize: 12, color: "var(--ah-text-primary)" }}>{new Date(`${l.startDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
              <button onClick={() => void removePeriod(l.id)} aria-label="Hapus" style={delBtn}>Hapus</button>
            </div>
          ))}
        </div>
      )}

      {!pred && (
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Catat tanggal mulai haid untuk melihat perkiraan siklus.</p>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>{CYCLE_DISCLAIMER}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const phaseBadge: React.CSSProperties = {
  width: 56, height: 56, borderRadius: "50%", flexShrink: 0, border: "2px solid",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
};
const miniLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)" };
const input: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 14, width: "100%",
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
  background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "6px 12px",
};
const delBtn: React.CSSProperties = {
  minHeight: 28, padding: "0 10px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-tertiary)", fontSize: 11, fontWeight: 600, cursor: "pointer",
};
