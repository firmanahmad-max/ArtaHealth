import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   ArtaHealth — Prototipe Interaktif v2
   Beranda + Silent Killer Guard (Risk Panel, klasifikasi
   PERHI/InaSH & PERKENI, red-flag flow, trend chart pita zona)
   Sesuai: Blueprint v1.0-TB · UI/UX Spec v1.0-DS · Addendum v1.0-SK
   ============================================================ */

const T = {
  bg: "#0A0E1A", surface1: "#111629", surface2: "#1A2138",
  glass: "rgba(26,33,56,0.72)", border: "rgba(148,163,208,0.14)",
  blue: "#3B82F6", cyan: "#22D3EE", purple: "#8B5CF6",
  textPri: "#F3F6FF", textSec: "#9AA5C4", textTer: "#5E6A8C",
  excellent: "#34D399", good: "#22D3EE", fair: "#FBBF24", low: "#F87171",
  orange: "#FB923C",
  sleep: "#818CF8", hydration: "#38BDF8", activity: "#2DD4BF",
  nutrition: "#FB923C", mood: "#F472B6", medical: "#A78BFA",
};

const ZONE = {
  green: { color: T.excellent, label: "Normal" },
  yellow: { color: T.fair, label: "Waspada" },
  orange: { color: T.orange, label: "Perlu Perhatian" },
  red: { color: T.low, label: "Tinggi" },
  redflag: { color: T.low, label: "Segera" },
};

/* ============================================================
   BIOMARKER ENGINE (deterministik — packages/core/biomarker-engine)
   ============================================================ */

/* Tekanan darah — Konsensus PERHI/InaSH 2021 (adopsi ESC/ESH 2018) */
const BP_BANDS = [
  { key: "optimal", label: "Optimal", zone: "green",
    advice: "Tekanan darah Anda optimal. Pertahankan gaya hidup sehat!" },
  { key: "normal", label: "Normal", zone: "green",
    advice: "Tekanan darah Anda di rentang normal. Pertahankan!" },
  { key: "high_normal", label: "Normal-Tinggi", zone: "yellow",
    advice: "Sedikit di atas normal. Kurangi garam dan cek lagi minggu depan." },
  { key: "ht1", label: "Hipertensi Derajat 1", zone: "orange",
    advice: "Berada di rentang Hipertensi Derajat 1. Jadwalkan pemeriksaan ke dokter untuk konfirmasi." },
  { key: "ht2", label: "Hipertensi Derajat 2", zone: "red",
    advice: "Berada di rentang Hipertensi Derajat 2. Segera jadwalkan konsultasi dengan dokter." },
  { key: "ht3", label: "Hipertensi Derajat 3", zone: "redflag",
    advice: "Angka ini perlu perhatian segera." },
];
function bpCatIndex(sys, dia) {
  const s = sys >= 180 ? 5 : sys >= 160 ? 4 : sys >= 140 ? 3 : sys >= 130 ? 2 : sys >= 120 ? 1 : 0;
  const d = dia >= 110 ? 5 : dia >= 100 ? 4 : dia >= 90 ? 3 : dia >= 85 ? 2 : dia >= 80 ? 1 : 0;
  return Math.max(s, d); // klasifikasi mengikuti kategori tertinggi
}
const classifyBP = (sys, dia) => BP_BANDS[bpCatIndex(sys, dia)];

/* Gula darah — kriteria PERKENI */
function classifyGlucose(value, context) {
  if (value < 70)
    return { key: "hypo", label: "Rendah (Hipoglikemia)", zone: "redflag",
      advice: "Gula darah di bawah 70 mg/dL perlu penanganan segera." };
  if (value >= 300)
    return { key: "veryhigh", label: "Sangat Tinggi", zone: "redflag",
      advice: "Angka ini perlu perhatian segera." };
  const th = context === "gdp" ? { pre: 100, dm: 126 } : { pre: 140, dm: 200 };
  if (value >= th.dm)
    return { key: "dm_range", label: "Rentang Kriteria Diabetes", zone: "orange",
      advice: "Berada di rentang kriteria diabetes menurut PERKENI — perlu pemeriksaan konfirmasi oleh dokter." };
  if (value >= th.pre)
    return { key: "predm", label: "Prediabetes", zone: "yellow",
      advice: "Berada di rentang prediabetes. Perbaikan pola makan & aktivitas terbukti membantu — dan konfirmasikan ke dokter." };
  return { key: "normal", label: "Normal", zone: "green",
    advice: "Gula darah Anda di rentang normal. Pertahankan!" };
}

const GUIDELINE = {
  bp: "Konsensus Hipertensi Indonesia (PERHI/InaSH) 2021",
  glucose: "Kriteria PERKENI",
};

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Hook: count-up ---------- */
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    if (prefersReduced()) { setVal(target); prevRef.current = target; return; }
    const from = prevRef.current, start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ---------- HealthRing ---------- */
function HealthRing({ score, size = 168, stroke = 12 }) {
  const displayed = useCountUp(score);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [sweep, setSweep] = useState(prefersReduced() ? score : 0);
  useEffect(() => {
    if (prefersReduced()) { setSweep(score); return; }
    const id = requestAnimationFrame(() => setSweep(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  const band = score >= 85 ? { l: "Sangat Baik", c: T.excellent } : score >= 70 ? { l: "Baik", c: T.good }
    : score >= 50 ? { l: "Cukup", c: T.fair } : { l: "Perlu Perhatian", c: T.low };
  return (
    <div role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}
      aria-label={`Health Score ${score} dari 100, ${band.l}`}
      style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="ahHero" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={T.blue} /><stop offset="50%" stopColor={T.cyan} /><stop offset="100%" stopColor={T.purple} />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.surface2} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#ahHero)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * sweep) / 100}
          style={{ transition: prefersReduced() ? "none" : "stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)",
            filter: "drop-shadow(0 0 8px rgba(34,211,238,0.35))" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 2 }}>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", color: T.textPri,
          fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {displayed}<span style={{ fontSize: 16, color: T.textTer, fontWeight: 500 }}>/100</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: band.c }}>💙 {band.l}</div>
      </div>
    </div>
  );
}

/* ---------- Confetti ---------- */
function Confetti({ trigger }) {
  const [parts, setParts] = useState([]);
  useEffect(() => {
    if (!trigger || prefersReduced()) return;
    const colors = [T.blue, T.cyan, T.purple, T.excellent];
    setParts(Array.from({ length: 12 }, (_, i) => ({
      id: `${trigger}-${i}`, x: (Math.random() - 0.5) * 140, y: -40 - Math.random() * 80,
      rot: Math.random() * 360, color: colors[i % 4], delay: Math.random() * 120,
    })));
    const t = setTimeout(() => setParts([]), 900);
    return () => clearTimeout(t);
  }, [trigger]);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {parts.map((p) => (
        <div key={p.id} style={{ position: "absolute", left: "50%", top: "50%", width: 6, height: 6,
          borderRadius: 2, background: p.color, opacity: 0,
          animation: `ahConfetti 600ms cubic-bezier(0.16,1,0.3,1) ${p.delay}ms forwards`,
          "--tx": `${p.x}px`, "--ty": `${p.y}px`, "--rot": `${p.rot}deg` }} />
      ))}
    </div>
  );
}

function Chip({ label, color }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}1F`,
    padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{label}</span>;
}

/* ---------- Slider row (input biomarker) ---------- */
function SliderRow({ label, value, setValue, min, max, unit, color }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 28, fontWeight: 700, color: T.textPri, fontVariantNumeric: "tabular-nums" }}>
          {value}<span style={{ fontSize: 12, color: T.textTer, fontWeight: 500, marginLeft: 4 }}>{unit}</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setValue(Math.max(min, value - 1))} aria-label={`Kurangi ${label}`}
          style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${T.border}`,
            background: T.surface2, color: T.textPri, fontSize: 16, cursor: "pointer" }}>−</button>
        <input type="range" min={min} max={max} value={value} aria-label={label}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ flex: 1, accentColor: color || T.cyan, height: 28 }} />
        <button onClick={() => setValue(Math.min(max, value + 1))} aria-label={`Tambah ${label}`}
          style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${T.border}`,
            background: T.surface2, color: T.textPri, fontSize: 16, cursor: "pointer" }}>+</button>
      </div>
    </div>
  );
}

/* ---------- Sheet wrapper ---------- */
function Sheet({ open, onClose, children, tall }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,14,26,0.65)", zIndex: 44 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.surface1,
        borderRadius: "20px 20px 0 0", border: `1px solid ${T.border}`, padding: "12px 20px 28px",
        zIndex: 45, maxHeight: tall ? "88%" : "72%", overflowY: "auto",
        animation: prefersReduced() ? "none" : "ahSlideUp 300ms cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: T.border, margin: "0 auto 14px" }} />
        {children}
      </div>
    </>
  );
}

function PrimaryBtn({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
      background: danger ? T.low : `linear-gradient(135deg, ${T.blue}, ${T.cyan} 55%, ${T.purple})`,
      color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>{children}</button>
  );
}
function GhostBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "13px 0", borderRadius: 14,
      border: `1px solid ${T.border}`, background: "transparent", color: T.textSec,
      fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 10 }}>{children}</button>
  );
}

/* ---------- Kartu hasil klasifikasi ---------- */
function BandResult({ band, values, guideline }) {
  const z = ZONE[band.zone];
  return (
    <div style={{ background: T.surface2, border: `1px solid ${z.color}55`, borderRadius: 16,
      padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: T.textPri, fontVariantNumeric: "tabular-nums" }}>{values}</span>
        <Chip label={band.label} color={z.color} />
      </div>
      <div style={{ fontSize: 13.5, color: T.textPri, lineHeight: 1.55 }}>{band.advice}</div>
      <div style={{ fontSize: 10.5, color: T.textTer, marginTop: 8 }}>Berdasarkan {guideline}</div>
    </div>
  );
}

/* ============================================================
   BP SHEET — input → hasil → (red-flag: ukur ulang → darurat)
   ============================================================ */
function BPSheet({ open, onClose, onSave, onEmergencyReminder }) {
  const [phase, setPhase] = useState("input"); // input|result|recheckWait|recheckInput|emergency
  const [sys, setSys] = useState(120);
  const [dia, setDia] = useState(80);
  const [first, setFirst] = useState(null);
  const [timer, setTimer] = useState(300);
  const band = classifyBP(sys, dia);

  useEffect(() => { if (open) { setPhase("input"); setSys(120); setDia(80); setFirst(null); } }, [open]);
  useEffect(() => {
    if (phase !== "recheckWait") return;
    setTimer(300);
    const iv = setInterval(() => setTimer((t) => (t <= 1 ? (clearInterval(iv), setPhase("recheckInput"), 0) : t - 1)), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  const submit = () => {
    if (band.zone === "redflag") {
      if (!first) { setFirst({ sys, dia }); setPhase("recheckWait"); }
      else { onSave({ sys, dia, band }, true); setPhase("emergency"); }
    } else {
      setPhase("result");
    }
  };
  const mmss = `${String(Math.floor(timer / 60)).padStart(1, "0")}:${String(timer % 60).padStart(2, "0")}`;

  return (
    <Sheet open={open} onClose={onClose} tall>
      {phase === "input" || phase === "recheckInput" ? (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri, textAlign: "center", marginBottom: 4 }}>
            {phase === "recheckInput" ? "Pengukuran Kedua" : "Catat Tekanan Darah"} 🩺
          </div>
          <div style={{ fontSize: 12, color: T.textSec, textAlign: "center", marginBottom: 18 }}>
            {phase === "recheckInput"
              ? "Masukkan hasil pengukuran ulang Anda."
              : "Duduk tenang, kaki menapak lantai, manset sejajar jantung."}
          </div>
          <SliderRow label="Sistolik (atas)" value={sys} setValue={setSys} min={80} max={220} unit="mmHg" color={T.low} />
          <SliderRow label="Diastolik (bawah)" value={dia} setValue={setDia} min={40} max={130} unit="mmHg" color={T.blue} />
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <Chip label={band.label} color={ZONE[band.zone].color} />
          </div>
          <PrimaryBtn onClick={submit}>Klasifikasikan</PrimaryBtn>
          <GhostBtn onClick={onClose}>Batal</GhostBtn>
        </>
      ) : phase === "result" ? (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri, textAlign: "center", marginBottom: 14 }}>Hasil</div>
          <BandResult band={band} values={`${sys}/${dia} mmHg`} guideline={GUIDELINE.bp} />
          <PrimaryBtn onClick={() => { onSave({ sys, dia, band }, false); onClose(); }}>Simpan Catatan</PrimaryBtn>
          <GhostBtn onClick={() => setPhase("input")}>Ubah Nilai</GhostBtn>
        </>
      ) : phase === "recheckWait" ? (
        <>
          <div style={{ textAlign: "center", padding: "8px 4px" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧘</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri }}>
              Istirahat dulu, lalu ukur ulang
            </div>
            <div style={{ fontSize: 13, color: T.textSec, marginTop: 8, lineHeight: 1.6 }}>
              Hasil {first?.sys}/{first?.dia} mmHg berada di rentang yang perlu dikonfirmasi.
              Duduk tenang selama 5 menit, tarik napas perlahan, lalu ukur kembali.
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, color: T.cyan, fontVariantNumeric: "tabular-nums",
              margin: "18px 0 6px" }}>{mmss}</div>
            <div style={{ fontSize: 11, color: T.textTer, marginBottom: 14 }}>menit tersisa</div>
            <PrimaryBtn onClick={() => setPhase("recheckInput")}>Saya Sudah Mengukur Ulang</PrimaryBtn>
            <GhostBtn onClick={onClose}>Nanti Saja — Simpan Sebagai Catatan</GhostBtn>
          </div>
        </>
      ) : (
        /* ---- emergency ---- */
        <>
          <div style={{ background: `${T.low}14`, border: `1.5px solid ${T.low}`, borderRadius: 16,
            padding: 18, textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.low, marginBottom: 6 }}>
              PERLU PERHATIAN SEGERA
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.textPri, fontVariantNumeric: "tabular-nums" }}>
              {sys}/{dia} mmHg
            </div>
            <div style={{ fontSize: 13.5, color: T.textPri, lineHeight: 1.6, marginTop: 10 }}>
              Dua pengukuran berturut-turut berada di rentang Hipertensi Derajat 3.
              Segera hubungi atau kunjungi fasilitas kesehatan terdekat — terutama bila disertai
              nyeri dada, sesak napas, sakit kepala hebat, atau gangguan penglihatan.
            </div>
          </div>
          <a href="tel:119" style={{ textDecoration: "none" }}>
            <PrimaryBtn danger onClick={() => {}}>📞 Hubungi 119</PrimaryBtn>
          </a>
          <GhostBtn onClick={() => { onEmergencyReminder(); onClose(); }}>
            Ingatkan Saya Konfirmasi ke Dokter
          </GhostBtn>
          <div style={{ fontSize: 10.5, color: T.textTer, textAlign: "center", marginTop: 12 }}>
            Catatan Anda tersimpan. Klasifikasi ini bersifat edukasi, bukan diagnosis.
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ============================================================
   GLUCOSE SHEET — konteks PERKENI (GDP / GDS / 2 jam PP)
   ============================================================ */
function GlucoseSheet({ open, onClose, onSave }) {
  const [phase, setPhase] = useState("input");
  const [ctx, setCtx] = useState("gdp");
  const [val, setVal] = useState(100);
  useEffect(() => { if (open) { setPhase("input"); setCtx("gdp"); setVal(100); } }, [open]);
  const band = classifyGlucose(val, ctx);
  const ctxs = [
    { id: "gdp", label: "Puasa" }, { id: "gds", label: "Sewaktu" }, { id: "pp2", label: "2 Jam Makan" },
  ];
  return (
    <Sheet open={open} onClose={onClose} tall>
      {phase === "input" ? (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri, textAlign: "center", marginBottom: 14 }}>
            Catat Gula Darah 🩸
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {ctxs.map((c) => (
              <button key={c.id} onClick={() => setCtx(c.id)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${ctx === c.id ? T.cyan : T.border}`,
                  background: ctx === c.id ? `${T.cyan}1A` : T.surface2,
                  color: ctx === c.id ? T.cyan : T.textSec }}>
                {c.label}
              </button>
            ))}
          </div>
          <SliderRow label="Kadar gula darah" value={val} setValue={setVal} min={40} max={400}
            unit="mg/dL" color={T.nutrition} />
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <Chip label={band.label} color={ZONE[band.zone].color} />
          </div>
          <PrimaryBtn onClick={() => setPhase("result")}>Klasifikasikan</PrimaryBtn>
          <GhostBtn onClick={onClose}>Batal</GhostBtn>
        </>
      ) : (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri, textAlign: "center", marginBottom: 14 }}>Hasil</div>
          <BandResult band={band}
            values={`${val} mg/dL · ${ctxs.find((c) => c.id === ctx).label}`}
            guideline={GUIDELINE.glucose} />
          {band.zone === "redflag" && (
            <a href="tel:119" style={{ textDecoration: "none" }}>
              <PrimaryBtn danger onClick={() => {}}>📞 Hubungi 119</PrimaryBtn>
            </a>
          )}
          <PrimaryBtn onClick={() => { onSave({ val, ctx, band }); onClose(); }}>Simpan Catatan</PrimaryBtn>
          <GhostBtn onClick={() => setPhase("input")}>Ubah Nilai</GhostBtn>
        </>
      )}
    </Sheet>
  );
}

/* ============================================================
   TREND CHART — garis di atas pita zona berwarna
   ============================================================ */
function TrendChart({ points, bands, yMin, yMax, unit }) {
  const W = 320, H = 140, PX = 8;
  const y = (v) => H - ((v - yMin) / (yMax - yMin)) * H;
  const x = (i) => PX + (i / Math.max(points.length - 1, 1)) * (W - 2 * PX);
  const line = points.map((p, i) => `${x(i)},${y(p.v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: "auto" }}
      aria-label={`Grafik tren, nilai terakhir ${points[points.length - 1].v} ${unit}`}>
      {bands.map((b, i) => (
        <rect key={i} x={0} y={y(Math.min(b.to, yMax))} width={W}
          height={Math.max(y(Math.max(b.from, yMin)) - y(Math.min(b.to, yMax)), 0)}
          fill={b.color} opacity={0.1} />
      ))}
      {bands.map((b, i) => b.from > yMin && b.from < yMax ? (
        <line key={`l${i}`} x1={0} x2={W} y1={y(b.from)} y2={y(b.from)}
          stroke={b.color} strokeOpacity={0.35} strokeDasharray="3 4" strokeWidth={1} />
      ) : null)}
      <polyline points={line} fill="none" stroke={T.cyan} strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.v)} r={i === points.length - 1 ? 5 : 3.5}
          fill={i === points.length - 1 ? T.cyan : T.surface2}
          stroke={T.cyan} strokeWidth={1.5} />
      ))}
      {points.map((p, i) => (
        <text key={`t${i}`} x={x(i)} y={H + 14} textAnchor="middle" fontSize={8.5} fill={T.textTer}>
          {p.label}
        </text>
      ))}
    </svg>
  );
}

/* ============================================================
   BP DETAIL SHEET — trend + riwayat
   ============================================================ */
function BPDetailSheet({ open, onClose, readings }) {
  const pts = readings.slice(-6).map((r) => ({ v: r.sys, label: r.when }));
  return (
    <Sheet open={open} onClose={onClose} tall>
      <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri, marginBottom: 2 }}>Tekanan Darah</div>
      <div style={{ fontSize: 11, color: T.textTer, marginBottom: 14 }}>
        Klasifikasi berdasarkan {GUIDELINE.bp}
      </div>
      {pts.length >= 2 ? (
        <>
          <div style={{ fontSize: 12, color: T.textSec, marginBottom: 6 }}>Tren Sistolik (mmHg)</div>
          <TrendChart points={pts} yMin={95} yMax={190} unit="mmHg"
            bands={[
              { from: 0, to: 120, color: T.excellent },
              { from: 120, to: 130, color: T.good },
              { from: 130, to: 140, color: T.fair },
              { from: 140, to: 160, color: T.orange },
              { from: 160, to: 300, color: T.low },
            ]} />
        </>
      ) : (
        <div style={{ fontSize: 13, color: T.textSec, padding: "16px 0" }}>
          Catat minimal 2 pengukuran untuk melihat tren.
        </div>
      )}
      <div style={{ fontSize: 12, color: T.textSec, margin: "16px 0 8px" }}>Riwayat</div>
      {readings.slice().reverse().map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.textPri, fontVariantNumeric: "tabular-nums" }}>
              {r.sys}/{r.dia}
            </span>
            <span style={{ fontSize: 11, color: T.textTer, marginLeft: 8 }}>{r.when}</span>
          </div>
          <Chip label={r.band.label} color={ZONE[r.band.zone].color} />
        </div>
      ))}
      <GhostBtn onClick={onClose}>Tutup</GhostBtn>
    </Sheet>
  );
}

/* ============================================================
   RISK PANEL — Silent Killer Guard di Beranda
   ============================================================ */
function RiskPanel({ bp, glucose, uric, onBP, onGlucose, onBPDetail, onLipid }) {
  const Row = ({ icon, name, value, chip, chipColor, sub, onClick, empty, emptyCta }) => (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
      background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "12px 2px",
      cursor: "pointer", textAlign: "left" }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, background: `${T.medical}1A`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.textPri }}>{name}</div>
        <div style={{ fontSize: 11, color: T.textTer, marginTop: 1 }}>{sub}</div>
      </div>
      {empty ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: T.cyan, border: `1px dashed ${T.border}`,
          borderRadius: 8, padding: "4px 10px" }}>{emptyCta || "+ Catat"}</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.textPri, fontVariantNumeric: "tabular-nums" }}>{value}</span>
          <Chip label={chip} color={chipColor} />
        </div>
      )}
    </button>
  );
  const last = bp[bp.length - 1];
  const g = glucose[glucose.length - 1];
  return (
    <div style={{ background: T.surface1, border: `1px solid ${T.border}`, borderRadius: 20, padding: "14px 16px 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textPri }}>🛡️ Silent Killer Guard</div>
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
            Pantau kondisi yang sering tak bergejala
          </div>
        </div>
      </div>
      <Row icon="🩺" name="Tekanan Darah" sub={last ? last.when : "Belum pernah dicatat"}
        value={last ? `${last.sys}/${last.dia}` : null}
        chip={last?.band.label} chipColor={last ? ZONE[last.band.zone].color : null}
        empty={!last} onClick={last ? onBPDetail : onBP} />
      <Row icon="🩸" name="Gula Darah" sub={g ? `${g.when} · ${g.ctxLabel}` : "Belum pernah dicatat"}
        value={g ? `${g.val} mg/dL` : null}
        chip={g?.band.label} chipColor={g ? ZONE[g.band.zone].color : null}
        empty={!g} onClick={onGlucose} />
      <Row icon="🧪" name="Kolesterol" sub="Input manual & Vault OCR — hadir di V2"
        empty emptyCta="Segera" onClick={onLipid} />
      <Row icon="💎" name="Asam Urat" sub="34 hari lalu" value={`${uric.val} mg/dL`}
        chip="Perlu diperbarui" chipColor={T.textTer} onClick={() => {}} />
      <div style={{ fontSize: 10, color: T.textTer, padding: "8px 2px 10px" }}>
        Klasifikasi mengikuti standar PERHI/InaSH & PERKENI · edukasi, bukan diagnosis
      </div>
    </div>
  );
}

/* ---------- MetricCard, Toast, FAB, Mood (dari v1, dipadatkan) ---------- */
function MetricCard({ icon, name, value, unit, chip, chipColor, color, onLog }) {
  const empty = value === null;
  return (
    <div style={{ background: T.surface1, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: "12px 10px", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", minWidth: 0 }}>
      <div style={{ fontSize: 16, color }}>{icon}</div>
      <div style={{ fontSize: 11, color: T.textSec, fontWeight: 500 }}>{name}</div>
      {empty ? (
        <button onClick={onLog} style={{ fontSize: 12, fontWeight: 600, color: T.cyan, background: "transparent",
          border: `1px dashed ${T.border}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>+ Catat</button>
      ) : (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri, fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1, whiteSpace: "nowrap" }}>
            {value}{unit && <span style={{ fontSize: 10, color: T.textTer, fontWeight: 500, marginLeft: 2 }}>{unit}</span>}
          </div>
          {chip && <Chip label={chip} color={chipColor} />}
        </>
      )}
    </div>
  );
}

function Toast({ toast, onUndo }) {
  if (!toast) return null;
  return (
    <div style={{ position: "absolute", bottom: 84, left: 16, right: 16, background: T.surface2,
      border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 16px", display: "flex",
      alignItems: "center", justifyContent: "space-between", boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      animation: prefersReduced() ? "none" : "ahSlideUp 300ms cubic-bezier(0.16,1,0.3,1)", zIndex: 40 }}>
      <span style={{ fontSize: 13, color: T.textPri }}>
        <span style={{ color: T.excellent, marginRight: 6 }}>✓</span>{toast.msg}
      </span>
      {toast.undoable && (
        <button onClick={onUndo} style={{ fontSize: 13, fontWeight: 600, color: T.cyan, background: "transparent",
          border: "none", cursor: "pointer", padding: "4px 8px" }}>Urungkan</button>
      )}
    </div>
  );
}

function QuickLogFAB({ actions }) {
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState(false);
  return (
    <>
      {open && <div onClick={() => setOpen(false)}
        style={{ position: "absolute", inset: 0, background: "rgba(10,14,26,0.6)", zIndex: 30 }} />}
      <div style={{ position: "absolute", right: 16, bottom: 88, zIndex: 31, display: "flex",
        flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        {open && actions.map((a, i) => (
          <button key={a.label}
            onClick={() => { setOpen(false); const r = a.fn(); if (r === "check") { setCheck(true);
              if (navigator.vibrate) navigator.vibrate(10); setTimeout(() => setCheck(false), 700); } }}
            style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface2,
              border: `1px solid ${T.border}`, borderRadius: 999, padding: "10px 16px", color: T.textPri,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              animation: prefersReduced() ? "none" : `ahPopIn 250ms cubic-bezier(0.34,1.56,0.64,1) ${i * 40}ms backwards`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
            <span style={{ fontSize: 16 }}>{a.icon}</span>{a.label}
          </button>
        ))}
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Tutup menu catat cepat" : "Buka menu catat cepat"}
          style={{ width: 56, height: 56, borderRadius: 999, border: "none",
            background: check ? T.excellent : `linear-gradient(135deg, ${T.blue}, ${T.cyan} 55%, ${T.purple})`,
            color: "#fff", fontSize: 24, cursor: "pointer", boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            transition: prefersReduced() ? "none" : "transform 250ms cubic-bezier(0.34,1.56,0.64,1), background 200ms",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          {check ? "✓" : "+"}
        </button>
      </div>
    </>
  );
}

function MoodSheet({ open, onPick, onClose }) {
  const moods = [{ v: 1, e: "😞" }, { v: 2, e: "😕" }, { v: 3, e: "😐" }, { v: 4, e: "🙂" }, { v: 5, e: "😄" }];
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 600, color: T.textPri, textAlign: "center" }}>
        Bagaimana perasaan Anda hari ini?
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, padding: "0 8px" }}>
        {moods.map((m) => (
          <button key={m.v} onClick={() => onPick(m.v)} aria-label={`Mood ${m.v} dari 5`}
            style={{ fontSize: 32, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 16,
              width: 54, height: 54, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {m.e}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------- Timeline ---------- */
function TimelineScreen({ logs }) {
  return (
    <div style={{ padding: "16px 16px 120px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.textPri, marginBottom: 4 }}>Timeline</div>
      <div style={{ fontSize: 12, color: T.textSec, marginBottom: 16 }}>Hari ini</div>
      {logs.slice().reverse().map((l) => (
        <div key={l.id} style={{ display: "flex", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 44, fontSize: 11, color: T.textTer, paddingTop: 14, fontVariantNumeric: "tabular-nums" }}>{l.time}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, background: `${l.color}22`,
              border: `1px solid ${l.color}55`, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, marginTop: 6 }}>{l.icon}</div>
            <div style={{ width: 2, flex: 1, background: T.border, minHeight: 10 }} />
          </div>
          <div style={{ flex: 1, background: T.surface1, border: `1px solid ${T.border}`, borderRadius: 14,
            padding: "10px 14px", marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.textPri }}>{l.title}</div>
            <div style={{ fontSize: 12, color: T.textSec }}>{l.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
export default function ArtaHealthPrototypeV2() {
  const [tab, setTab] = useState("beranda");
  const [waterMl, setWaterMl] = useState(2100);
  const [mood, setMood] = useState(4);
  const [banner, setBanner] = useState(true);
  const [toast, setToast] = useState(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [moodOpen, setMoodOpen] = useState(false);
  const [bpOpen, setBpOpen] = useState(false);
  const [bpDetailOpen, setBpDetailOpen] = useState(false);
  const [gluOpen, setGluOpen] = useState(false);

  /* Seed data biomarker (riwayat 5 minggu — tren membaik) */
  const [bpReadings, setBpReadings] = useState([
    { sys: 148, dia: 94, when: "5 mgg", band: classifyBP(148, 94) },
    { sys: 142, dia: 90, when: "4 mgg", band: classifyBP(142, 90) },
    { sys: 138, dia: 88, when: "3 mgg", band: classifyBP(138, 88) },
    { sys: 135, dia: 86, when: "2 mgg", band: classifyBP(135, 86) },
    { sys: 132, dia: 84, when: "6 hari lalu", band: classifyBP(132, 84) },
  ]);
  const [gluReadings, setGluReadings] = useState([
    { val: 105, ctx: "gdp", ctxLabel: "Puasa", when: "12 hari lalu", band: classifyGlucose(105, "gdp") },
  ]);
  const uric = { val: 6.8 };

  const [logs, setLogs] = useState([
    { id: 1, time: "07.00", icon: "🌙", color: T.sleep, title: "Tidur", detail: "7j 45m · Baik" },
    { id: 2, time: "07.30", icon: "💧", color: T.hydration, title: "Minum Air", detail: "250 ml" },
    { id: 3, time: "12.15", icon: "🍛", color: T.nutrition, title: "Makan Siang", detail: "Nasi ayam, sayur · 650 kkal" },
  ]);
  const prevScoreRef = useRef(null);
  const toastTimer = useRef(null);

  const TARGET_ML = 2500, steps = 8456;
  const sHyd = Math.min(waterMl / TARGET_ML, 1) * 100;
  const score = Math.round(0.3 * 100 + 0.2 * sHyd + 0.25 * Math.min(steps / 8000, 1) * 100 + 0.1 * mood * 20 + 0.15 * 60);

  useEffect(() => {
    if (prevScoreRef.current !== null && score > prevScoreRef.current) setConfettiKey((k) => k + 1);
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
      setWaterMl((v) => v - 250); setLogs((l) => l.slice(0, -1)); setToast(null);
    });
    return "check";
  };
  const saveBP = ({ sys, dia, band }, silent) => {
    setBpReadings((r) => [...r, { sys, dia, when: "Baru saja", band }]);
    setLogs((l) => [...l, { id: Date.now(), time: now(), icon: "🩺", color: T.medical,
      title: "Tekanan Darah", detail: `${sys}/${dia} mmHg · ${band.label}` }]);
    if (!silent) showToast(`Tensi ${sys}/${dia} dicatat · ${band.label}`);
  };
  const saveGlucose = ({ val, ctx, band }) => {
    const ctxLabel = ctx === "gdp" ? "Puasa" : ctx === "gds" ? "Sewaktu" : "2 Jam Makan";
    setGluReadings((r) => [...r, { val, ctx, ctxLabel, when: "Baru saja", band }]);
    setLogs((l) => [...l, { id: Date.now(), time: now(), icon: "🩸", color: T.medical,
      title: "Gula Darah", detail: `${val} mg/dL (${ctxLabel}) · ${band.label}` }]);
    showToast(`Gula darah ${val} mg/dL dicatat · ${band.label}`);
  };
  const pickMood = (v) => {
    setMood(v); setMoodOpen(false);
    setLogs((l) => [...l, { id: Date.now(), time: now(), icon: "😊", color: T.mood, title: "Mood", detail: `${v}/5` }]);
    showToast("Mood dicatat");
  };
  const emergencyReminder = () => {
    setLogs((l) => [...l, { id: Date.now(), time: now(), icon: "⏰", color: T.low,
      title: "Pengingat Dibuat", detail: "Konfirmasi tekanan darah ke dokter" }]);
    showToast("Pengingat konfirmasi ke dokter dibuat untuk besok pagi");
  };

  const hour = new Date().getHours();
  const greet = hour < 10 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  const sub = hour >= 18 || hour < 4 ? "Waktunya bersiap istirahat 🌙" : "Semangat menjalani hari yang sehat!";

  const fabActions = [
    { icon: "💧", label: "Air 250 ml", fn: logWater },
    { icon: "🩺", label: "Tensi", fn: () => setBpOpen(true) },
    { icon: "🩸", label: "Gula Darah", fn: () => setGluOpen(true) },
    { icon: "😊", label: "Mood", fn: () => setMoodOpen(true) },
    { icon: "⚖️", label: "Berat", fn: () => showToast("Input berat hadir di build berikutnya") },
  ];

  const tabs = [
    { id: "beranda", icon: "🏠", label: "Beranda" }, { id: "timeline", icon: "📅", label: "Timeline" },
    { id: "chat", icon: "🤖", label: "AI Chat" }, { id: "program", icon: "🏋", label: "Program" },
    { id: "profil", icon: "👤", label: "Profil" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#050810", display: "flex", justifyContent: "center",
      alignItems: "flex-start", padding: "24px 8px",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        @keyframes ahConfetti { 0% { opacity: 1; transform: translate(0,0) rotate(0); } 100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); } }
        @keyframes ahSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes ahPopIn { from { transform: scale(0.7) translateY(8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes ahFadeUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid ${T.cyan}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400, background: T.bg, borderRadius: 32,
        border: `1px solid ${T.border}`, overflow: "hidden", position: "relative", minHeight: 800,
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: T.glass,
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${T.border}`, padding: "18px 16px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.textPri }}>{greet}, Firman 👋</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{sub}</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 999,
            background: `linear-gradient(135deg, ${T.blue}, ${T.purple})`, display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>F</div>
        </div>

        {/* Beranda */}
        {tab === "beranda" && (
          <div style={{ padding: "16px 16px 140px", display: "flex", flexDirection: "column", gap: 12 }}>
            {banner && (
              <div style={{ background: "linear-gradient(135deg, rgba(59,130,246,.16), rgba(139,92,246,.16))",
                border: "1px solid rgba(139,92,246,0.3)", borderRadius: 20, padding: 14, display: "flex",
                gap: 12, animation: "ahFadeUp 300ms cubic-bezier(0.16,1,0.3,1)" }}>
                <div style={{ fontSize: 26 }}>🤖</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.cyan, marginBottom: 3 }}>✦ AI HEALTH INSIGHT</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.textPri, lineHeight: 1.4 }}>
                    Tren tekanan darah Anda membaik 5 minggu terakhir 📉
                  </div>
                  <div style={{ fontSize: 12.5, color: T.textSec, marginTop: 3, lineHeight: 1.5 }}>
                    Dari 148/94 menjadi 132/84 mmHg — konsistensi jalan kaki Anda tampak sejalan dengan perbaikan ini.
                  </div>
                </div>
                <button onClick={() => setBanner(false)} aria-label="Tutup insight"
                  style={{ background: "none", border: "none", color: T.textTer, fontSize: 14, cursor: "pointer", height: 24 }}>✕</button>
              </div>
            )}

            {/* Hero */}
            <div style={{ background: T.surface1, border: `1px solid ${T.border}`, borderRadius: 20,
              padding: 20, position: "relative", overflow: "hidden" }}>
              <Confetti trigger={confettiKey} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.textPri }}>Health Score ⓘ</div>
                <button onClick={() => showToast(`Rincian: Tidur 30 · Aktivitas 25 · Hidrasi ${Math.round(0.2 * sHyd)} · Mood ${mood * 2} · Habit 9`)}
                  style={{ background: "none", border: "none", color: T.cyan, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Detail ›
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}><HealthRing score={score} /></div>
              <div style={{ textAlign: "center", fontSize: 11, color: T.textTer, marginTop: 10 }}>
                Skor perilaku harian — biomarker dipantau terpisah di Silent Killer Guard
              </div>
            </div>

            {/* Grid metrik */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <MetricCard icon="🌙" name="Tidur" value="7j 45m" chip="Baik" chipColor={T.excellent} color={T.sleep} />
              <MetricCard icon="👟" name="Aktivitas" value="8.456" unit="lkh" chip="106%" chipColor={T.good} color={T.activity} />
              <MetricCard icon="💧" name="Hidrasi" value={`${(waterMl / 1000).toFixed(1).replace(".", ",")} L`}
                chip={waterMl >= TARGET_ML ? "Tercapai" : `${Math.round((waterMl / TARGET_ML) * 100)}%`}
                chipColor={waterMl >= TARGET_ML ? T.excellent : T.fair} color={T.hydration} />
              <MetricCard icon="😊" name="Mood" value={`${mood}/5`} chip={mood >= 4 ? "Baik" : "Cukup"}
                chipColor={mood >= 4 ? T.excellent : T.fair} color={T.mood} />
            </div>

            {/* ★ Silent Killer Guard */}
            <RiskPanel bp={bpReadings} glucose={gluReadings} uric={uric}
              onBP={() => setBpOpen(true)} onGlucose={() => setGluOpen(true)}
              onBPDetail={() => setBpDetailOpen(true)}
              onLipid={() => showToast("Kolesterol via input manual & Vault OCR hadir di V2 ✨")} />

            {/* AI Recommendation kontekstual biomarker */}
            <button onClick={() => showToast("Ditambahkan: cek tensi tiap Senin pagi 💪")}
              style={{ background: T.surface1, border: `1px solid ${T.border}`, borderRadius: 20, padding: 16,
                display: "flex", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer", width: "100%" }}>
              <div style={{ fontSize: 20 }}>✨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.purple, marginBottom: 3 }}>AI RECOMMENDATION</div>
                <div style={{ fontSize: 13.5, color: T.textPri, lineHeight: 1.5 }}>
                  Tren tensi Anda membaik. Jadikan pengecekan rutin tiap Senin pagi sebagai kebiasaan agar kemajuan tetap terpantau.
                </div>
              </div>
              <div style={{ color: T.textTer, fontSize: 18 }}>›</div>
            </button>

            <div style={{ fontSize: 10.5, color: T.textTer, textAlign: "center", padding: "4px 24px", lineHeight: 1.5 }}>
              ArtaHealth memberi edukasi & insight gaya hidup — bukan pengganti konsultasi dokter.
            </div>
          </div>
        )}

        {tab === "timeline" && <TimelineScreen logs={logs} />}
        {tab === "chat" && <Placeholder title="Arta siap membantu" desc="AI Chat dengan Safety Guard — konteks biomarker Anda ikut dipahami. Dibangun di sprint berikutnya." />}
        {tab === "program" && <Placeholder title="Program Kesehatan" desc="Kendalikan Tensi 30 Hari · Hidup Sehat dengan Prediabetes · Better Sleep — kurikulum habit terjadwal." />}
        {tab === "profil" && <Placeholder title="Profil & Keamanan" desc="Family Health, Emergency Card, biometrik, dan kontrol data Anda (UU PDP)." />}

        {(tab === "beranda" || tab === "timeline") && <QuickLogFAB actions={fabActions} />}

        <BPSheet open={bpOpen} onClose={() => setBpOpen(false)} onSave={saveBP} onEmergencyReminder={emergencyReminder} />
        <GlucoseSheet open={gluOpen} onClose={() => setGluOpen(false)} onSave={saveGlucose} />
        <BPDetailSheet open={bpDetailOpen} onClose={() => setBpDetailOpen(false)} readings={bpReadings} />
        <MoodSheet open={moodOpen} onPick={pickMood} onClose={() => setMoodOpen(false)} />
        <Toast toast={toast} onUndo={toast?.undo} />

        {/* Bottom nav */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.glass,
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: `1px solid ${T.border}`,
          display: "flex", padding: "8px 8px 14px", zIndex: 35 }}>
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-label={t.label}
                aria-current={active ? "page" : undefined}
                style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex",
                  flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0" }}>
                <span style={{ fontSize: 18, filter: active ? "none" : "grayscale(1) opacity(0.5)" }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? T.cyan : T.textTer }}>{t.label}</span>
                <span style={{ width: 4, height: 4, borderRadius: 999,
                  background: active ? `linear-gradient(135deg, ${T.cyan}, ${T.purple})` : "transparent" }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
