"use client";
import { useRef, useState } from "react";
import type { RppgResult } from "@arta/core";
import { startPulseCapture, cameraSupported, type CaptureHandle } from "@/lib/rppg-capture";
import { useMounted } from "@/lib/useMounted";

/**
 * Cek Nadi via kamera (Fase 6 · RP-1, SPIKE/PoC). Ujung jari + flash → estimasi BPM
 * on-device. BUKAN alat medis, bukan diagnosis. Di balik flag NEXT_PUBLIC_FEATURE_RPPG.
 * Video tak diunggah/disimpan; hasil = engine deterministik core.
 */

const DURATION = 18;

type Phase = "idle" | "measuring" | "done" | "error";

export function PulseCheckCard() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [signal, setSignal] = useState(0);          // rata-rata merah frame terakhir (0..255)
  const [result, setResult] = useState<RppgResult | null>(null);
  const [error, setError] = useState<string>("");
  const handleRef = useRef<CaptureHandle | null>(null);
  const mounted = useMounted();

  // Hindari hydration mismatch: server tak punya `navigator` → anggap didukung sampai mount.
  const supported = mounted ? cameraSupported() : true;

  const begin = async () => {
    setError(""); setResult(null); setElapsed(0); setSignal(0); setPhase("measuring");
    try {
      handleRef.current = await startPulseCapture(
        { durationSec: DURATION },
        {
          onProgress: (e, _t, latest) => { setElapsed(e); setSignal(latest); },
          onDone: (r) => { setResult(r); setPhase("done"); handleRef.current = null; },
          onError: (err) => { setError(err.message); setPhase("error"); handleRef.current = null; },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengakses kamera.");
      setPhase("error");
    }
  };

  const stopEarly = () => { void handleRef.current?.stop(); };
  const cancel = () => { handleRef.current?.cancel(); handleRef.current = null; setPhase("idle"); };
  const reset = () => { setResult(null); setPhase("idle"); };

  const pct = Math.min(100, Math.round((elapsed / DURATION) * 100));
  // proxy "jari terdeteksi": frame merah pekat (flash menembus jari) → nilai R tinggi
  const fingerOn = signal > 80;

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>
          ❤️ Cek Nadi <span style={betaTag}>eksperimen</span>
        </p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Perkiraan denyut dari kamera — bukan alat medis. Diproses di perangkatmu, video tak disimpan.
        </p>
      </div>

      {!supported && (
        <div style={noteBox}>Perangkat/browser ini tak mendukung akses kamera untuk fitur ini.</div>
      )}

      {phase === "idle" && supported && (
        <>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li style={step}>Tempelkan <b>ujung jari telunjuk</b> menutup kamera belakang.</li>
            <li style={step}>Biarkan <b>lampu flash</b> menyala menembus jari (otomatis bila didukung).</li>
            <li style={step}>Tahan diam ±{DURATION} detik sampai selesai.</li>
          </ol>
          <button onClick={() => void begin()} style={primaryBtn}>Mulai ukur</button>
        </>
      )}

      {phase === "measuring" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{fingerOn ? "🫰" : "📷"}</span>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ah-text-primary)" }}>
              {fingerOn ? "Sinyal terbaca — tahan diam…" : "Tempelkan jari menutup kamera & flash…"}
            </p>
          </div>
          <div style={barTrack}><div style={{ ...barFill, width: `${pct}%` }} /></div>
          <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
            {elapsed.toFixed(0)} / {DURATION} dtk · mutu sinyal {fingerOn ? "baik" : "lemah"}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={stopEarly} style={ghostBtn}>Selesai sekarang</button>
            <button onClick={cancel} style={ghostBtn}>Batal</button>
          </div>
        </div>
      )}

      {phase === "done" && result && <ResultView result={result} onRetry={reset} />}

      {phase === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={noteBox}>{error || "Terjadi kesalahan."} Pastikan izin kamera diberikan.</div>
          <button onClick={reset} style={primaryBtn}>Coba lagi</button>
        </div>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Estimasi kasar untuk kesadaran diri — jangan dipakai untuk keputusan medis atau keadaan darurat.
        Tidak mengukur SpO₂ dan tidak mendeteksi gangguan irama jantung.
      </p>
    </div>
  );
}

function ResultView({ result, onRetry }: { result: RppgResult; onRetry: () => void }) {
  if (result.status === "insufficient") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={noteBox}>Data belum cukup (durasi/frame terlalu sedikit). Tahan lebih lama & jari menutup kamera.</div>
        <button onClick={onRetry} style={primaryBtn}>Ukur lagi</button>
      </div>
    );
  }
  const weak = result.status === "low_quality";
  const bpm = result.bpm;
  const oddResting = bpm != null && (bpm < 40 || bpm > 120);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 40, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {bpm ?? "—"}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ah-text-tertiary)" }}>BPM</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: weak ? "#FB923C" : "var(--ah-score-excellent)" }}>
          {weak ? "sinyal lemah" : `keyakinan ${Math.round(result.confidence * 100)}%`}
        </span>
      </div>
      {weak && (
        <div style={noteBox}>Sinyal kurang stabil — angka ini kurang andal. Ulangi: jari menutup rata, tahan diam, hindari cahaya luar.</div>
      )}
      {!weak && oddResting && (
        <div style={noteBox}>Bila kamu merasa berdebar/pusing/tak nyaman, sebaiknya hubungi tenaga kesehatan. Ini bukan diagnosis.</div>
      )}
      <button onClick={onRetry} style={primaryBtn}>Ukur lagi</button>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const betaTag: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, color: "#FB923C", border: "1px solid #FB923C",
  borderRadius: "var(--ah-r-full)", padding: "1px 6px", marginLeft: 6, verticalAlign: "middle",
};
const step: React.CSSProperties = { fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.4 };
const noteBox: React.CSSProperties = {
  fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.45,
  background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
};
const barTrack: React.CSSProperties = {
  height: 8, borderRadius: "var(--ah-r-full)", background: "var(--ah-surface-2)", overflow: "hidden",
};
const barFill: React.CSSProperties = {
  height: "100%", borderRadius: "var(--ah-r-full)", background: "var(--ah-gradient-hero)", transition: "width .2s",
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  minHeight: 40, flex: 1, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
