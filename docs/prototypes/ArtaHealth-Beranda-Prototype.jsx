import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   ArtaHealth — Prototipe Interaktif Beranda (v1)
   Validasi: design tokens, HealthRing motion, quick-log flow
   Sesuai: ArtaHealth-UIUX-Specification.md v1.0-DS
   ============================================================ */

const T = {
  bg: "#0A0E1A",
  surface1: "#111629",
  surface2: "#1A2138",
  glass: "rgba(26,33,56,0.72)",
  border: "rgba(148,163,208,0.14)",
  blue: "#3B82F6",
  cyan: "#22D3EE",
  purple: "#8B5CF6",
  textPri: "#F3F6FF",
  textSec: "#9AA5C4",
  textTer: "#5E6A8C",
  excellent: "#34D399",
  good: "#22D3EE",
  fair: "#FBBF24",
  low: "#F87171",
  sleep: "#818CF8",
  hydration: "#38BDF8",
  activity: "#2DD4BF",
  nutrition: "#FB923C",
  mood: "#F472B6",
  heart: "#FB7185",
};

const scoreBand = (s) =>
  s >= 85
    ? { label: "Sangat Baik", color: T.excellent }
    : s >= 70
    ? { label: "Baik", color: T.good }
    : s >= 50
    ? { label: "Cukup", color: T.fair }
    : { label: "Perlu Perhatian", color: T.low };

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Hook: count-up angka (1200ms) ---------- */
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    if (prefersReduced()) {
      setVal(target);
      prevRef.current = target;
      return;
    }
    const from = prevRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ---------- HealthRing (signature component) ---------- */
function HealthRing({ score, size = 168, stroke = 12, showLabel = true }) {
  const displayed = useCountUp(score);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [sweep, setSweep] = useState(prefersReduced() ? score : 0);
  useEffect(() => {
    if (prefersReduced()) {
      setSweep(score);
      return;
    }
    const id = requestAnimationFrame(() => setSweep(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  const band = scoreBand(score);
  return (
    <div
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Health Score ${score} dari 100, ${band.label}`}
      style={{ position: "relative", width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="ahHero" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={T.blue} />
            <stop offset="50%" stopColor={T.cyan} />
            <stop offset="100%" stopColor={T.purple} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={T.surface2}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ahHero)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * sweep) / 100}
          style={{
            transition: prefersReduced()
              ? "none"
              : "stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)",
            filter: "drop-shadow(0 0 8px rgba(34,211,238,0.35))",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: size >= 160 ? 44 : 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: T.textPri,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {displayed}
          <span style={{ fontSize: size >= 160 ? 16 : 11, color: T.textTer, fontWeight: 500 }}>
            /100
          </span>
        </div>
        {showLabel && (
          <div style={{ fontSize: 12, fontWeight: 600, color: band.color }}>
            💙 {band.label}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Micro-confetti (≤12 partikel, area ring) ---------- */
function Confetti({ trigger }) {
  const [parts, setParts] = useState([]);
  useEffect(() => {
    if (!trigger || prefersReduced()) return;
    const colors = [T.blue, T.cyan, T.purple, T.excellent];
    setParts(
      Array.from({ length: 12 }, (_, i) => ({
        id: `${trigger}-${i}`,
        x: (Math.random() - 0.5) * 140,
        y: -40 - Math.random() * 80,
        rot: Math.random() * 360,
        color: colors[i % 4],
        delay: Math.random() * 120,
      }))
    );
    const t = setTimeout(() => setParts([]), 900);
    return () => clearTimeout(t);
  }, [trigger]);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {parts.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 6,
            height: 6,
            borderRadius: 2,
            background: p.color,
            animation: `ahConfetti 600ms cubic-bezier(0.16,1,0.3,1) ${p.delay}ms forwards`,
            "--tx": `${p.x}px`,
            "--ty": `${p.y}px`,
            "--rot": `${p.rot}deg`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- StatusChip ---------- */
function Chip({ label, color }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}1F`,
        padding: "3px 9px",
        borderRadius: 999,
      }}
    >
      {label}
    </span>
  );
}

/* ---------- MetricCard ---------- */
function MetricCard({ icon, name, value, unit, chip, chipColor, color, onLog }) {
  const empty = value === null;
  return (
    <div
      style={{
        background: T.surface1,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-start",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 16, color }}>{icon}</div>
      <div style={{ fontSize: 11, color: T.textSec, fontWeight: 500 }}>{name}</div>
      {empty ? (
        <button
          onClick={onLog}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.cyan,
            background: "transparent",
            border: `1px dashed ${T.border}`,
            borderRadius: 8,
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          + Catat
        </button>
      ) : (
        <>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: T.textPri,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            {value}
            {unit && (
              <span style={{ fontSize: 10, color: T.textTer, fontWeight: 500, marginLeft: 2 }}>
                {unit}
              </span>
            )}
          </div>
          {chip && <Chip label={chip} color={chipColor} />}
        </>
      )}
    </div>
  );
}

/* ---------- HydrationTracker ---------- */
function HydrationTracker({ ml, target, onAdd }) {
  const glasses = Math.round(target / 250);
  const filled = Math.min(Math.floor(ml / 250), glasses);
  const pct = Math.min(Math.round((ml / target) * 100), 100);
  return (
    <div
      style={{
        background: T.surface1,
        border: `1px solid ${T.border}`,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textPri }}>Hidrasi</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: T.textPri,
              fontVariantNumeric: "tabular-nums",
              marginTop: 4,
            }}
          >
            {(ml / 1000).toFixed(1).replace(".", ",")}{" "}
            <span style={{ fontSize: 13, color: T.textTer, fontWeight: 500 }}>
              / {(target / 1000).toFixed(1).replace(".", ",")} L
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Target Harian</div>
        </div>
        <div style={{ position: "relative", width: 64, height: 64 }}>
          <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={32} cy={32} r={27} fill="none" stroke={T.surface2} strokeWidth={7} />
            <circle
              cx={32}
              cy={32}
              r={27}
              fill="none"
              stroke={T.hydration}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 27}
              strokeDashoffset={2 * Math.PI * 27 * (1 - pct / 100)}
              style={{ transition: "stroke-dashoffset 300ms cubic-bezier(0.16,1,0.3,1)" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: T.hydration,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {pct}%
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 14, alignItems: "center" }}>
        {Array.from({ length: glasses }, (_, i) => (
          <button
            key={i}
            onClick={i >= filled ? onAdd : undefined}
            aria-label={i < filled ? "Gelas terisi" : "Catat 250 ml air"}
            style={{
              width: 24,
              height: 30,
              borderRadius: "4px 4px 7px 7px",
              border: `1.5px solid ${i < filled ? T.hydration : T.border}`,
              background: i < filled ? `${T.hydration}33` : "transparent",
              position: "relative",
              cursor: i >= filled ? "pointer" : "default",
              overflow: "hidden",
              padding: 0,
            }}
          >
            {i < filled && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "70%",
                  background: `${T.hydration}66`,
                  animation: prefersReduced() ? "none" : "ahFill 300ms ease-out",
                }}
              />
            )}
          </button>
        ))}
        <button
          onClick={onAdd}
          aria-label="Tambah catatan minum"
          style={{
            marginLeft: "auto",
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "none",
            background: T.surface2,
            color: T.textPri,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

/* ---------- Sleep card (bar 7 hari — data manual, tanpa fase palsu) ---------- */
function SleepCard() {
  const week = [6.8, 7.2, 6.5, 7.8, 7.1, 7.4, 7.75];
  const avg = week.reduce((a, b) => a + b, 0) / 7;
  const max = 9;
  return (
    <div
      style={{
        background: T.surface1,
        border: `1px solid ${T.border}`,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textPri }}>Analisis Tidur</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: T.textPri,
              fontVariantNumeric: "tabular-nums",
              marginTop: 4,
            }}
          >
            7<span style={{ fontSize: 13, color: T.textTer }}>j</span> 45
            <span style={{ fontSize: 13, color: T.textTer }}>m</span>
          </div>
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Durasi tidur semalam</div>
        </div>
        <Chip label="Baik" color={T.excellent} />
      </div>
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 56, marginTop: 14 }}
        aria-label={`Tidur 7 hari terakhir, rata-rata ${avg.toFixed(1)} jam per malam`}
      >
        {week.map((h, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <div
              style={{
                width: "100%",
                maxWidth: 22,
                height: `${(h / max) * 100}%`,
                borderRadius: 5,
                background:
                  i === 6
                    ? `linear-gradient(180deg, ${T.cyan}, ${T.sleep})`
                    : `${T.sleep}55`,
              }}
            />
            <div style={{ fontSize: 9, color: T.textTer }}>
              {["S", "S", "R", "K", "J", "S", "M"][i]}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.textSec, marginTop: 8 }}>
        Rata-rata minggu ini: <span style={{ color: T.textPri, fontWeight: 600 }}>{avg.toFixed(1).replace(".", ",")} jam</span> · konsistensi jam tidur baik
      </div>
    </div>
  );
}

/* ---------- Toast dengan Undo ---------- */
function Toast({ toast, onUndo }) {
  if (!toast) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 84,
        left: 16,
        right: 16,
        background: T.surface2,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        animation: prefersReduced() ? "none" : "ahSlideUp 300ms cubic-bezier(0.16,1,0.3,1)",
        zIndex: 40,
      }}
    >
      <span style={{ fontSize: 13, color: T.textPri }}>
        <span style={{ color: T.excellent, marginRight: 6 }}>✓</span>
        {toast.msg}
      </span>
      {toast.undoable && (
        <button
          onClick={onUndo}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T.cyan,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Urungkan
        </button>
      )}
    </div>
  );
}

/* ---------- Quick-Log FAB ---------- */
function QuickLogFAB({ onWater, onMood }) {
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState(false);
  const water = () => {
    onWater();
    setOpen(false);
    setCheck(true);
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => setCheck(false), 700);
  };
  const actions = [
    { icon: "💧", label: "Air 250 ml", fn: water },
    { icon: "😊", label: "Mood", fn: () => { onMood(); setOpen(false); } },
    { icon: "⚖️", label: "Berat", fn: () => setOpen(false) },
    { icon: "🏃", label: "Aktivitas", fn: () => setOpen(false) },
  ];
  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "absolute", inset: 0, background: "rgba(10,14,26,0.6)", zIndex: 30 }}
        />
      )}
      <div style={{ position: "absolute", right: 16, bottom: 88, zIndex: 31, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        {open &&
          actions.map((a, i) => (
            <button
              key={a.label}
              onClick={a.fn}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 999,
                padding: "10px 16px",
                color: T.textPri,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                animation: prefersReduced()
                  ? "none"
                  : `ahPopIn 250ms cubic-bezier(0.34,1.56,0.64,1) ${i * 40}ms backwards`,
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              {a.label}
            </button>
          ))}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Tutup menu catat cepat" : "Buka menu catat cepat"}
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            border: "none",
            background: check ? T.excellent : `linear-gradient(135deg, ${T.blue}, ${T.cyan} 55%, ${T.purple})`,
            color: "#fff",
            fontSize: 24,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            transition: prefersReduced()
              ? "none"
              : "transform 250ms cubic-bezier(0.34,1.56,0.64,1), background 200ms",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {check ? "✓" : "+"}
        </button>
      </div>
    </>
  );
}

/* ---------- Mood sheet ---------- */
function MoodSheet({ open, onPick, onClose }) {
  if (!open) return null;
  const moods = [
    { v: 1, e: "😞" }, { v: 2, e: "😕" }, { v: 3, e: "😐" }, { v: 4, e: "🙂" }, { v: 5, e: "😄" },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,14,26,0.6)", zIndex: 44 }} />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: T.surface1,
          borderRadius: "20px 20px 0 0",
          border: `1px solid ${T.border}`,
          padding: "12px 20px 32px",
          zIndex: 45,
          animation: prefersReduced() ? "none" : "ahSlideUp 300ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 999, background: T.border, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: T.textPri, textAlign: "center" }}>
          Bagaimana perasaan Anda hari ini?
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, padding: "0 8px" }}>
          {moods.map((m) => (
            <button
              key={m.v}
              onClick={() => onPick(m.v)}
              aria-label={`Mood ${m.v} dari 5`}
              style={{
                fontSize: 32,
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                width: 54,
                height: 54,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {m.e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Timeline sederhana (tab kedua) ---------- */
function TimelineScreen({ logs }) {
  return (
    <div style={{ padding: "16px 16px 120px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.textPri, marginBottom: 4 }}>Timeline</div>
      <div style={{ fontSize: 12, color: T.textSec, marginBottom: 16 }}>Hari ini</div>
      {logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: T.textSec }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 14 }}>Belum ada catatan hari ini.</div>
          <div style={{ fontSize: 12, color: T.textTer, marginTop: 4 }}>
            Gunakan tombol + untuk mulai mencatat.
          </div>
        </div>
      ) : (
        logs
          .slice()
          .reverse()
          .map((l) => (
            <div key={l.id} style={{ display: "flex", gap: 12, marginBottom: 4 }}>
              <div style={{ width: 44, fontSize: 11, color: T.textTer, paddingTop: 14, fontVariantNumeric: "tabular-nums" }}>
                {l.time}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: `${l.color}22`,
                    border: `1px solid ${l.color}55`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    marginTop: 6,
                  }}
                >
                  {l.icon}
                </div>
                <div style={{ width: 2, flex: 1, background: T.border, minHeight: 10 }} />
              </div>
              <div
                style={{
                  flex: 1,
                  background: T.surface1,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "10px 14px",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: T.textPri }}>{l.title}</div>
                <div style={{ fontSize: 12, color: T.textSec }}>{l.detail}</div>
              </div>
            </div>
          ))
      )}
    </div>
  );
}

/* ---------- Placeholder tab ---------- */
function Placeholder({ title, desc }) {
  return (
    <div style={{ padding: "80px 32px", textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>🤖</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: T.textPri }}>{title}</div>
      <div style={{ fontSize: 13, color: T.textSec, marginTop: 8, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

/* ============================================================ MAIN ============================================================ */
export default function ArtaHealthPrototype() {
  const [tab, setTab] = useState("beranda");
  const [waterMl, setWaterMl] = useState(2100);
  const [mood, setMood] = useState(4);
  const [moodOpen, setMoodOpen] = useState(false);
  const [banner, setBanner] = useState(true);
  const [toast, setToast] = useState(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [logs, setLogs] = useState([
    { id: 1, time: "07.00", icon: "🌙", color: T.sleep, title: "Tidur", detail: "7j 45m · Baik" },
    { id: 2, time: "07.30", icon: "💧", color: T.hydration, title: "Minum Air", detail: "250 ml" },
    { id: 3, time: "12.15", icon: "🍛", color: T.nutrition, title: "Makan Siang", detail: "Nasi ayam, sayur · 650 kkal" },
  ]);
  const prevScoreRef = useRef(null);
  const toastTimer = useRef(null);

  const TARGET_ML = 2500;
  const steps = 8456;

  /* --- Skor deterministik (mini scoring engine, sesuai blueprint §4) --- */
  const sSleep = 100; // 7j45m, konsisten
  const sHyd = Math.min(waterMl / TARGET_ML, 1) * 100;
  const sAct = Math.min(steps / 8000, 1) * 100;
  const sMood = mood * 20;
  const sHabit = 60; // 3/5 habit
  const score = Math.round(0.3 * sSleep + 0.2 * sHyd + 0.25 * sAct + 0.1 * sMood + 0.15 * sHabit);

  useEffect(() => {
    if (prevScoreRef.current !== null && score > prevScoreRef.current) {
      setConfettiKey((k) => k + 1);
    }
    prevScoreRef.current = score;
  }, [score]);

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const showToast = useCallback((msg, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undoable: !!undo, undo });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const logWater = () => {
    setWaterMl((v) => v + 250);
    setLogs((l) => [...l, { id: Date.now(), time: now(), icon: "💧", color: T.hydration, title: "Minum Air", detail: "250 ml" }]);
    showToast("Air 250 ml dicatat", () => {
      setWaterMl((v) => v - 250);
      setLogs((l) => l.slice(0, -1));
      setToast(null);
    });
  };

  const pickMood = (v) => {
    setMood(v);
    setMoodOpen(false);
    setLogs((l) => [...l, { id: Date.now(), time: now(), icon: "😊", color: T.mood, title: "Mood", detail: `${v}/5` }]);
    showToast("Mood dicatat");
  };

  const hour = new Date().getHours();
  const greet =
    hour < 10 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  const sub =
    hour >= 18 || hour < 4 ? "Waktunya bersiap istirahat 🌙" : "Semangat menjalani hari yang sehat!";
  const band = scoreBand(score);

  const tabs = [
    { id: "beranda", icon: "🏠", label: "Beranda" },
    { id: "timeline", icon: "📅", label: "Timeline" },
    { id: "chat", icon: "🤖", label: "AI Chat" },
    { id: "program", icon: "🏋", label: "Program" },
    { id: "profil", icon: "👤", label: "Profil" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050810",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "24px 8px",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        @keyframes ahConfetti { 0% { opacity: 1; transform: translate(0,0) rotate(0); } 100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); } }
        @keyframes ahSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes ahPopIn { from { transform: scale(0.7) translateY(8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes ahFill { from { height: 0; } to { height: 70%; } }
        @keyframes ahFadeUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        button:focus-visible { outline: 2px solid ${T.cyan}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      {/* ---- Phone frame ---- */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: T.bg,
          borderRadius: 32,
          border: `1px solid ${T.border}`,
          overflow: "hidden",
          position: "relative",
          minHeight: 780,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* ---- Header glass ---- */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: T.glass,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: `1px solid ${T.border}`,
            padding: "18px 16px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.textPri }}>
              {greet}, Firman 👋
            </div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{sub}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              aria-label="Notifikasi"
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                border: `1px solid ${T.border}`,
                background: T.surface1,
                color: T.textPri,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              🔔
            </button>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${T.blue}, ${T.purple})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              F
            </div>
          </div>
        </div>

        {/* ---- Content ---- */}
        {tab === "beranda" && (
          <div style={{ padding: "16px 16px 140px", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Insight banner */}
            {banner && (
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,.16), rgba(139,92,246,.16))",
                  border: `1px solid rgba(139,92,246,0.3)`,
                  borderRadius: 20,
                  padding: 14,
                  display: "flex",
                  gap: 12,
                  animation: "ahFadeUp 300ms cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                <div style={{ fontSize: 26 }}>🤖</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.cyan, marginBottom: 3 }}>
                    ✦ AI HEALTH INSIGHT
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.textPri, lineHeight: 1.4 }}>
                    Health Score Anda naik 6 poin dibanding kemarin 🎉
                  </div>
                  <div style={{ fontSize: 12.5, color: T.textSec, marginTop: 3, lineHeight: 1.5 }}>
                    Tidur lebih berkualitas dan target aktivitas tercapai dengan baik.
                  </div>
                </div>
                <button
                  onClick={() => setBanner(false)}
                  aria-label="Tutup insight"
                  style={{ background: "none", border: "none", color: T.textTer, fontSize: 14, cursor: "pointer", height: 24 }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Hero Health Score */}
            <div
              style={{
                background: T.surface1,
                border: `1px solid ${T.border}`,
                borderRadius: 20,
                padding: 20,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Confetti trigger={confettiKey} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.textPri }}>Health Score ⓘ</div>
                <button
                  style={{ background: "none", border: "none", color: T.cyan, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  onClick={() =>
                    showToast(
                      `Rincian: Tidur 30 · Aktivitas 25 · Hidrasi ${Math.round(0.2 * sHyd)} · Mood ${Math.round(0.1 * sMood)} · Habit 9`
                    )
                  }
                >
                  Detail ›
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <HealthRing score={score} />
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: T.textTer, marginTop: 10 }}>
                Skor dihitung dari tidur, aktivitas, hidrasi, mood, dan kebiasaan Anda
              </div>
            </div>

            {/* Grid metrik */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <MetricCard icon="🌙" name="Tidur" value="7j 45m" chip="Baik" chipColor={T.excellent} color={T.sleep} />
              <MetricCard icon="👟" name="Aktivitas" value="8.456" unit="lkh" chip="106%" chipColor={T.good} color={T.activity} />
              <MetricCard
                icon="💧"
                name="Hidrasi"
                value={`${(waterMl / 1000).toFixed(1).replace(".", ",")} L`}
                chip={waterMl >= TARGET_ML ? "Tercapai" : `${Math.round((waterMl / TARGET_ML) * 100)}%`}
                chipColor={waterMl >= TARGET_ML ? T.excellent : T.fair}
                color={T.hydration}
              />
              <MetricCard icon="🔥" name="Kalori" value={null} color={T.nutrition} onLog={() => showToast("Food Diary hadir di update berikutnya ✨")} />
            </div>

            {/* AI Recommendation */}
            <button
              onClick={() => showToast("Ditambahkan ke kebiasaan hari ini 💪")}
              style={{
                background: T.surface1,
                border: `1px solid ${T.border}`,
                borderRadius: 20,
                padding: 16,
                display: "flex",
                gap: 12,
                alignItems: "center",
                textAlign: "left",
                cursor: "pointer",
                width: "100%",
              }}
            >
              <div style={{ fontSize: 20 }}>✨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.purple, marginBottom: 3 }}>
                  AI RECOMMENDATION
                </div>
                <div style={{ fontSize: 13.5, color: T.textPri, lineHeight: 1.5 }}>
                  Jalan kaki 20 menit sore ini dapat membantu meningkatkan mood dan kualitas tidur malam Anda.
                </div>
              </div>
              <div style={{ color: T.textTer, fontSize: 18 }}>›</div>
            </button>

            <HydrationTracker ml={waterMl} target={TARGET_ML} onAdd={logWater} />
            <SleepCard />

            <div style={{ fontSize: 10.5, color: T.textTer, textAlign: "center", padding: "4px 24px", lineHeight: 1.5 }}>
              ArtaHealth memberi edukasi & insight gaya hidup — bukan pengganti konsultasi dokter.
            </div>
          </div>
        )}

        {tab === "timeline" && <TimelineScreen logs={logs} />}
        {tab === "chat" && (
          <Placeholder title="Arta siap membantu" desc="AI Chat dengan Safety Guard & disclaimer permanen — dibangun di sprint berikutnya." />
        )}
        {tab === "program" && (
          <Placeholder title="Program Kesehatan" desc="Weight Loss · Better Sleep · Stress Relief · Build Stamina — kurikulum habit terjadwal." />
        )}
        {tab === "profil" && (
          <Placeholder title="Profil & Keamanan" desc="Family Health, Emergency Card, biometrik, dan kontrol data Anda (UU PDP)." />
        )}

        {/* FAB + sheets + toast */}
        {(tab === "beranda" || tab === "timeline") && (
          <QuickLogFAB onWater={logWater} onMood={() => setMoodOpen(true)} />
        )}
        <MoodSheet open={moodOpen} onPick={pickMood} onClose={() => setMoodOpen(false)} />
        <Toast toast={toast} onUndo={toast?.undo} />

        {/* ---- Bottom nav ---- */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: T.glass,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            padding: "8px 8px 14px",
            zIndex: 35,
          }}
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "6px 0",
                }}
              >
                <span style={{ fontSize: 18, filter: active ? "none" : "grayscale(1) opacity(0.5)" }}>
                  {t.icon}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? T.cyan : T.textTer }}>
                  {t.label}
                </span>
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: active ? `linear-gradient(135deg, ${T.cyan}, ${T.purple})` : "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
