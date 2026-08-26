"use client";
import { useState } from "react";
import { STANCE_LABEL, STANCE_TONE, CLAIM_CHECK_DISCLAIMER, type ClaimStance } from "@arta/core";
import { checkClaim, type CheckResult } from "@/lib/claim-check";

/**
 * Cek Klaim Kesehatan (V3-4). Tempel klaim viral → gerbang deterministik (CK-1) lalu
 * penilaian AI berpagar (CK-2) + sumber resmi. Non-vonis, non-medis. Flag
 * NEXT_PUBLIC_FEATURE_CEK_KLAIM.
 */

const TONE: Record<"good" | "warn" | "bad" | "neutral", { color: string; bg: string }> = {
  good: { color: "var(--ah-score-excellent)", bg: "rgba(52,211,153,0.12)" },
  warn: { color: "#FB923C", bg: "rgba(251,146,60,0.12)" },
  bad: { color: "var(--ah-score-low)", bg: "rgba(248,113,113,0.14)" },
  neutral: { color: "var(--ah-text-secondary)", bg: "var(--ah-surface-2)" },
};

export function ClaimCheckCard() {
  const [claim, setClaim] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const run = async () => {
    if (!claim.trim()) return;
    setLoading(true); setResult(null);
    try { setResult(await checkClaim(claim)); }
    finally { setLoading(false); }
  };

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🔎 Cek Klaim Kesehatan</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Tempel klaim yang beredar — kami bantu memilah & arahkan ke sumber resmi. Bukan vonis, bukan nasihat medis.
        </p>
      </div>

      <textarea
        value={claim} onChange={(e) => setClaim(e.target.value)} rows={3}
        placeholder="mis. Rebusan daun X bikin gula darah normal tanpa obat"
        style={textarea}
      />
      <button onClick={() => void run()} disabled={loading || !claim.trim()} style={primaryBtn}>
        {loading ? "Memeriksa…" : "Periksa klaim"}
      </button>

      {result?.kind === "gated" && (
        <div style={{ ...box, background: TONE.bad.bg, border: `1.5px solid ${TONE.bad.color}` }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)" }}>Perlu kehati-hatian</p>
          <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.45, marginTop: 4 }}>{result.safety.message}</p>
        </div>
      )}

      {result?.kind === "error" && (
        <div style={box}><p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)" }}>{result.message}</p></div>
      )}

      {result?.kind === "assessment" && (() => {
        const a = result.assessment;
        const tone = TONE[STANCE_TONE[a.stance as ClaimStance]];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, color: tone.color, border: `1px solid ${tone.color}`, borderRadius: "var(--ah-r-full)", padding: "3px 10px" }}>
              {STANCE_LABEL[a.stance as ClaimStance]}
            </span>
            <p style={{ fontSize: 12.5, color: "var(--ah-text-primary)", lineHeight: 1.5 }}>{a.ringkasan}</p>
            {a.catatan_keamanan && (
              <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.45 }}>⚠️ {a.catatan_keamanan}</p>
            )}
            {a.sumber.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)" }}>Sumber resmi</p>
                {a.sumber.map((s, i) => (
                  <p key={i} style={{ fontSize: 11.5 }}>
                    {s.url
                      ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ah-cyan, #22D3EE)" }}>{s.label}</a>
                      : <span style={{ color: "var(--ah-text-secondary)" }}>{s.label}</span>}
                  </p>
                ))}
              </div>
            )}
            {result.fallback && (
              <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)" }}>Penilaian otomatis tak tersedia — menampilkan panduan aman.</p>
            )}
          </div>
        );
      })()}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>{CLAIM_CHECK_DISCLAIMER}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const textarea: React.CSSProperties = {
  borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)", background: "var(--ah-surface-1)",
  color: "var(--ah-text-primary)", padding: "10px 12px", fontSize: 13, width: "100%", resize: "vertical", fontFamily: "inherit",
};
const box: React.CSSProperties = {
  background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
