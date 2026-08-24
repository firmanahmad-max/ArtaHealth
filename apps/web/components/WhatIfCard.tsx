"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  projectScore, combineLevers, WHATIF_PRESETS, type DayInputs,
} from "@arta/core";
import { whatIfBaseline } from "@/lib/what-if";
import { db } from "@/lib/db";

/**
 * Simulasi "Bagaimana Jika" (V3-2). Pilih skenario perbaikan kebiasaan → lihat proyeksi
 * Health Score dari "hari khas"-mu (rata-rata terkini). Deterministik (reuse engine skor),
 * memotivasi, bukan janji medis. Flag NEXT_PUBLIC_FEATURE_WHATIF.
 */

export function WhatIfCard() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Baseline ikut segar saat ada catatan baru.
  const dep = useLiveQuery(async () => {
    const c = await Promise.all([
      db.sleep_logs.count(), db.hydration_logs.count(), db.activity_logs.count(), db.mood_logs.count(),
    ]);
    return c.join(",");
  }, []);
  const baseline = useLiveQuery<DayInputs | undefined>(() => whatIfBaseline(), [dep]);

  if (!baseline) return null;

  const chosen = WHATIF_PRESETS.filter((p) => selected.has(p.key));
  const proj = projectScore(baseline, combineLevers(chosen));
  const pct = Math.max(0, Math.min(100, proj.projectedScore));

  const toggle = (key: string) =>
    setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🔮 Bagaimana Jika</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Coba ubah kebiasaan — lihat perkiraan Health Score dari hari khasmu. Bukan janji, sekadar gambaran.
        </p>
      </div>

      {/* Skor: sekarang → proyeksi */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "center" }}>
          <p style={scoreNum}>{proj.baseScore}</p>
          <p style={scoreCap}>hari khas</p>
        </div>
        <span style={{ fontSize: 20, color: "var(--ah-text-tertiary)" }}>→</span>
        <div style={{ textAlign: "center" }}>
          <p style={{ ...scoreNum, color: proj.delta > 0 ? "var(--ah-score-excellent)" : proj.delta < 0 ? "var(--ah-score-low)" : "var(--ah-text-primary)" }}>
            {proj.projectedScore}
          </p>
          <p style={scoreCap}>proyeksi</p>
        </div>
        <div style={{ flex: 1 }}>
          <div style={barTrack}><div style={{ ...barFill, width: `${pct}%` }} /></div>
          <p style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: proj.delta > 0 ? "var(--ah-score-excellent)" : proj.delta < 0 ? "var(--ah-score-low)" : "var(--ah-text-tertiary)" }}>
            {proj.delta > 0 ? `+${proj.delta} poin` : proj.delta < 0 ? `${proj.delta} poin` : "Pilih skenario di bawah"}
          </p>
        </div>
      </div>

      {/* Skenario */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)" }}>Kalau aku…</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {WHATIF_PRESETS.map((p) => {
            const on = selected.has(p.key);
            return (
              <button key={p.key} onClick={() => toggle(p.key)} aria-pressed={on} style={chip(on)}>
                {p.icon} {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {proj.delta > 0 && (
        <p style={{ fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.45 }}>
          Konsisten dengan pilihan ini, Health Score harianmu bisa naik ~{proj.delta} poin. Mulai dari satu kebiasaan kecil.
        </p>
      )}
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Perkiraan deterministik dari rumus Health Score, bukan prediksi medis.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const scoreNum: React.CSSProperties = { fontSize: 30, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1, fontVariantNumeric: "tabular-nums" };
const scoreCap: React.CSSProperties = { fontSize: 9.5, color: "var(--ah-text-tertiary)", marginTop: 3 };
const barTrack: React.CSSProperties = { height: 8, borderRadius: "var(--ah-r-full)", background: "var(--ah-surface-2)", overflow: "hidden" };
const barFill: React.CSSProperties = { height: "100%", borderRadius: "var(--ah-r-full)", background: "var(--ah-gradient-hero)", transition: "width .3s" };
const chip = (on: boolean): React.CSSProperties => ({
  minHeight: 36, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
  border: on ? "1.5px solid var(--ah-cyan, #22D3EE)" : "1px solid var(--ah-border)",
  background: on ? "rgba(34,211,238,0.14)" : "var(--ah-surface-2)",
  color: "var(--ah-text-primary)", fontSize: 12, fontWeight: 700,
});
