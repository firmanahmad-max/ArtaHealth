"use client";
import { useEffect, useState } from "react";
import { SheetModal, useToast } from "@arta/design-system";
import { logHydration, logSleep, logActivity, logMood, logWeight, undoLog } from "@/lib/quicklog";
import { logBloodPressure, logGlucose, logLipid, logUricAcid, undoBiomarker } from "@/lib/biomarker";
import { featureBiomarker } from "@/lib/features";
import type { GlucoseContext, Sex } from "@arta/core";

type LogKind = "hydration" | "sleep" | "activity" | "mood" | "weight" | "bp" | "glucose" | "lipid" | "uric_acid";

const BASE_KINDS: { key: LogKind; icon: string; label: string }[] = [
  { key: "hydration", icon: "💧", label: "Air" },
  { key: "sleep", icon: "🌙", label: "Tidur" },
  { key: "activity", icon: "👟", label: "Aktivitas" },
  { key: "mood", icon: "🙂", label: "Mood" },
  { key: "weight", icon: "⚖️", label: "Berat" },
];
// Fase 2: biomarker hanya muncul di balik feature flag (ambang menunggu review medis)
const KINDS = featureBiomarker()
  ? [
      ...BASE_KINDS,
      { key: "bp" as LogKind, icon: "🫀", label: "Tensi" },
      { key: "glucose" as LogKind, icon: "🩸", label: "Gula" },
      { key: "lipid" as LogKind, icon: "🧈", label: "Lipid" },
      { key: "uric_acid" as LogKind, icon: "🦴", label: "Asam Urat" },
    ]
  : BASE_KINDS;

const GLUCOSE_CONTEXTS: { value: GlucoseContext; label: string; hint: string }[] = [
  { value: "gdp", label: "Puasa", hint: "GDP" },
  { value: "gds", label: "Sewaktu", hint: "GDS" },
  { value: "pp2", label: "2 jam", hint: "PP" },
  { value: "hba1c", label: "HbA1c", hint: "%" },
];

const ACTIVITY_TYPES = [
  { value: "walk", label: "Jalan" }, { value: "run", label: "Lari" }, { value: "cycle", label: "Sepeda" },
  { value: "gym", label: "Gym" }, { value: "stretch", label: "Peregangan" }, { value: "yoga", label: "Yoga" },
  { value: "other", label: "Lainnya" },
] as const;

const MOODS = [
  { value: 1, emoji: "😞" }, { value: 2, emoji: "😕" }, { value: 3, emoji: "😐" },
  { value: 4, emoji: "🙂" }, { value: 5, emoji: "😄" },
];

export function QuickLogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { show } = useToast();
  const [kind, setKind] = useState<LogKind>("hydration");
  const [busy, setBusy] = useState(false);

  // setiap buka sheet kembali ke Air — jalur tercepat log air <2 detik (gate Fase 1)
  useEffect(() => { if (open) setKind("hydration"); }, [open]);

  // form state
  const [sleepStart, setSleepStart] = useState("22:30");
  const [sleepEnd, setSleepEnd] = useState("05:30");
  const [actType, setActType] = useState<(typeof ACTIVITY_TYPES)[number]["value"]>("walk");
  const [actMin, setActMin] = useState("30");
  const [actSteps, setActSteps] = useState("");
  const [weight, setWeight] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [glucoseCtx, setGlucoseCtx] = useState<GlucoseContext>("gdp");
  const [glucoseVal, setGlucoseVal] = useState("");
  const [lipid, setLipid] = useState({ totalChol: "", ldl: "", hdl: "", tg: "" });
  const [uricVal, setUricVal] = useState("");
  const [uricSex, setUricSex] = useState<Sex>("male");

  const done = (message: string, table: Parameters<typeof undoLog>[0], clientId: string) => {
    onClose();
    show({ message, onUndo: () => void undoLog(table, clientId) });
  };
  const doneBiomarker = (message: string, clientId: string, redFlag: boolean) => {
    onClose();
    show({ variant: redFlag ? "error" : undefined, message, onUndo: () => void undoBiomarker(clientId) });
  };
  const fail = () => show({ variant: "error", message: "Gagal mencatat. Coba sekali lagi." });

  const quickWater = async (ml: number) => {
    try {
      const { clientId } = await logHydration(ml);
      done(`Air ${ml} ml tercatat`, "hydration_logs", clientId);
    } catch { fail(); }
  };

  const saveSleep = async () => {
    setBusy(true);
    try {
      // jam tidur > jam bangun → mulai kemarin malam
      const end = new Date(); const [eh, em] = sleepEnd.split(":").map(Number);
      end.setHours(eh, em, 0, 0);
      const start = new Date(end); const [sh, sm] = sleepStart.split(":").map(Number);
      start.setHours(sh, sm, 0, 0);
      if (start >= end) start.setDate(start.getDate() - 1);
      const { clientId } = await logSleep(start, end);
      const durMin = Math.round((end.getTime() - start.getTime()) / 60000);
      done(`Tidur ${Math.floor(durMin / 60)}j ${durMin % 60}m tercatat`, "sleep_logs", clientId);
    } catch { fail(); } finally { setBusy(false); }
  };

  const saveActivity = async () => {
    setBusy(true);
    try {
      const { clientId } = await logActivity(
        actType,
        actMin ? Number(actMin) : undefined,
        actSteps ? Number(actSteps) : undefined,
      );
      done("Aktivitas tercatat", "activity_logs", clientId);
    } catch { fail(); } finally { setBusy(false); }
  };

  const quickMood = async (value: number) => {
    try {
      const { clientId } = await logMood(value);
      done("Mood hari ini tercatat", "mood_logs", clientId);
    } catch { fail(); }
  };

  const saveWeight = async () => {
    setBusy(true);
    try {
      const { clientId } = await logWeight(Number(weight));
      done(`Berat ${weight} kg tercatat`, "weight_logs", clientId);
    } catch { fail(); } finally { setBusy(false); }
  };

  const saveBp = async () => {
    setBusy(true);
    try {
      const { clientId, classification } = await logBloodPressure(Number(systolic), Number(diastolic));
      setSystolic(""); setDiastolic("");
      doneBiomarker(`Tensi ${systolic}/${diastolic} — ${classification.band.label}`, clientId, classification.redFlag);
    } catch { fail(); } finally { setBusy(false); }
  };

  const saveGlucose = async () => {
    setBusy(true);
    try {
      const { clientId, classification } = await logGlucose(glucoseCtx, Number(glucoseVal));
      const label = GLUCOSE_CONTEXTS.find((c) => c.value === glucoseCtx)?.label ?? "";
      setGlucoseVal("");
      doneBiomarker(`Gula (${label}) ${glucoseVal} — ${classification.band.label}`, clientId, classification.redFlag);
    } catch { fail(); } finally { setBusy(false); }
  };

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const lipidHasValue = !!(lipid.totalChol || lipid.ldl || lipid.hdl || lipid.tg);
  const saveLipid = async () => {
    setBusy(true);
    try {
      const { clientId, classification } = await logLipid({
        totalChol: num(lipid.totalChol), ldl: num(lipid.ldl), hdl: num(lipid.hdl), tg: num(lipid.tg),
      });
      setLipid({ totalChol: "", ldl: "", hdl: "", tg: "" });
      doneBiomarker(`Lipid tercatat — ${classification.band.label}`, clientId, classification.redFlag);
    } catch { fail(); } finally { setBusy(false); }
  };

  const saveUricAcid = async () => {
    setBusy(true);
    try {
      const { clientId, classification } = await logUricAcid(Number(uricVal), uricSex);
      setUricVal("");
      doneBiomarker(`Asam urat ${uricVal} — ${classification.band.label}`, clientId, classification.redFlag);
    } catch { fail(); } finally { setBusy(false); }
  };

  return (
    <SheetModal open={open} onClose={onClose} title="Catat">
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {KINDS.map((k) => {
          const active = kind === k.key;
          return (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              aria-pressed={active}
              style={{
                minHeight: 44, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
                border: active ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
                background: active ? "var(--ah-gradient-soft)" : "var(--ah-surface-2)",
                color: "var(--ah-text-primary)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              {k.icon} {k.label}
            </button>
          );
        })}
      </div>

      {kind === "hydration" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[150, 250, 600].map((ml) => (
            <button key={ml} onClick={() => void quickWater(ml)} style={bigOption}>
              <span style={{ fontSize: 22 }}>💧</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{ml} ml</span>
              <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>
                {ml === 150 ? "Cangkir" : ml === 250 ? "Gelas" : "Botol"}
              </span>
            </button>
          ))}
        </div>
      )}

      {kind === "sleep" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={label}>
              Jam tidur
              <input type="time" value={sleepStart} onChange={(e) => setSleepStart(e.target.value)} style={input} />
            </label>
            <label style={label}>
              Jam bangun
              <input type="time" value={sleepEnd} onChange={(e) => setSleepEnd(e.target.value)} style={input} />
            </label>
          </div>
          <button onClick={() => void saveSleep()} disabled={busy} style={btnPrimary}>Catat Tidur</button>
        </div>
      )}

      {kind === "activity" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setActType(t.value)}
                aria-pressed={actType === t.value}
                style={{
                  minHeight: 44, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
                  border: actType === t.value ? "1.5px solid var(--ah-activity)" : "1px solid var(--ah-border)",
                  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", fontSize: 13,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={label}>
              Durasi (menit)
              <input type="number" inputMode="numeric" min={1} max={600} value={actMin} onChange={(e) => setActMin(e.target.value)} style={input} />
            </label>
            <label style={label}>
              Langkah <span style={{ fontWeight: 400 }}>(opsional)</span>
              <input type="number" inputMode="numeric" min={0} value={actSteps} onChange={(e) => setActSteps(e.target.value)} placeholder="—" style={input} />
            </label>
          </div>
          <button onClick={() => void saveActivity()} disabled={busy || (!actMin && !actSteps)} style={btnPrimary}>
            Catat Aktivitas
          </button>
        </div>
      )}

      {kind === "mood" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {MOODS.map((m) => (
            <button key={m.value} onClick={() => void quickMood(m.value)} aria-label={`Mood ${m.value} dari 5`} style={{ ...bigOption, fontSize: 26 }}>
              {m.emoji}
            </button>
          ))}
        </div>
      )}

      {kind === "weight" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={label}>
            Berat badan (kg)
            <input type="number" inputMode="decimal" min={20} max={400} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="62.5" style={input} />
          </label>
          <button onClick={() => void saveWeight()} disabled={busy || !weight} style={btnPrimary}>Catat Berat</button>
        </div>
      )}

      {kind === "bp" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={label}>
              Sistolik (atas)
              <input type="number" inputMode="numeric" min={50} max={300} value={systolic} onChange={(e) => setSystolic(e.target.value)} placeholder="120" style={input} />
            </label>
            <label style={label}>
              Diastolik (bawah)
              <input type="number" inputMode="numeric" min={30} max={200} value={diastolic} onChange={(e) => setDiastolic(e.target.value)} placeholder="80" style={input} />
            </label>
          </div>
          <p style={hint}>Ukur duduk tenang, lengan setinggi jantung. Satuan mmHg.</p>
          <button onClick={() => void saveBp()} disabled={busy || !systolic || !diastolic} style={btnPrimary}>Catat Tensi</button>
        </div>
      )}

      {kind === "glucose" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GLUCOSE_CONTEXTS.map((c) => (
              <button
                key={c.value}
                onClick={() => setGlucoseCtx(c.value)}
                aria-pressed={glucoseCtx === c.value}
                style={{
                  minHeight: 44, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
                  border: glucoseCtx === c.value ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
                  background: glucoseCtx === c.value ? "var(--ah-gradient-soft)" : "var(--ah-surface-2)",
                  color: "var(--ah-text-primary)", fontSize: 13, fontWeight: 600,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label style={label}>
            {glucoseCtx === "hba1c" ? "HbA1c (%)" : "Gula darah (mg/dL)"}
            <input
              type="number" inputMode="decimal"
              step={glucoseCtx === "hba1c" ? "0.1" : "1"}
              value={glucoseVal} onChange={(e) => setGlucoseVal(e.target.value)}
              placeholder={glucoseCtx === "hba1c" ? "5.6" : "95"} style={input}
            />
          </label>
          <button onClick={() => void saveGlucose()} disabled={busy || !glucoseVal} style={btnPrimary}>Catat Gula Darah</button>
        </div>
      )}

      {kind === "lipid" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={label}>
              Kolesterol Total
              <input type="number" inputMode="numeric" value={lipid.totalChol} onChange={(e) => setLipid({ ...lipid, totalChol: e.target.value })} placeholder="mg/dL" style={input} />
            </label>
            <label style={label}>
              LDL
              <input type="number" inputMode="numeric" value={lipid.ldl} onChange={(e) => setLipid({ ...lipid, ldl: e.target.value })} placeholder="mg/dL" style={input} />
            </label>
            <label style={label}>
              HDL
              <input type="number" inputMode="numeric" value={lipid.hdl} onChange={(e) => setLipid({ ...lipid, hdl: e.target.value })} placeholder="mg/dL" style={input} />
            </label>
            <label style={label}>
              Trigliserida
              <input type="number" inputMode="numeric" value={lipid.tg} onChange={(e) => setLipid({ ...lipid, tg: e.target.value })} placeholder="mg/dL" style={input} />
            </label>
          </div>
          <p style={hint}>Isi yang tersedia di hasil lab — minimal satu. Satuan mg/dL.</p>
          <button onClick={() => void saveLipid()} disabled={busy || !lipidHasValue} style={btnPrimary}>Catat Lipid</button>
        </div>
      )}

      {kind === "uric_acid" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {([["male", "Pria"], ["female", "Wanita"]] as const).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setUricSex(val)}
                aria-pressed={uricSex === val}
                style={{
                  flex: 1, minHeight: 44, borderRadius: "var(--ah-r-full)", cursor: "pointer",
                  border: uricSex === val ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
                  background: uricSex === val ? "var(--ah-gradient-soft)" : "var(--ah-surface-2)",
                  color: "var(--ah-text-primary)", fontSize: 13, fontWeight: 600,
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
          <label style={label}>
            Asam urat (mg/dL)
            <input type="number" inputMode="decimal" step="0.1" value={uricVal} onChange={(e) => setUricVal(e.target.value)} placeholder="5.5" style={input} />
          </label>
          <p style={hint}>Ambang berbeda pria (&lt;7,0) &amp; wanita (&lt;6,0).</p>
          <button onClick={() => void saveUricAcid()} disabled={busy || !uricVal} style={btnPrimary}>Catat Asam Urat</button>
        </div>
      )}
    </SheetModal>
  );
}

const bigOption: React.CSSProperties = {
  minHeight: 76, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", cursor: "pointer",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
  fontSize: 14, fontWeight: 700,
};
const btnPrimary: React.CSSProperties = {
  minHeight: 48, borderRadius: "var(--ah-r-inner)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ah-text-secondary)" };
const hint: React.CSSProperties = { fontSize: 11, color: "var(--ah-text-tertiary)", lineHeight: 1.4 };
const input: React.CSSProperties = {
  minHeight: 48, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 15,
};
