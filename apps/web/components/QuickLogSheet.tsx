"use client";
import { useEffect, useState } from "react";
import { SheetModal, useToast } from "@arta/design-system";
import { logHydration, logSleep, logActivity, logMood, logWeight, undoLog } from "@/lib/quicklog";

type LogKind = "hydration" | "sleep" | "activity" | "mood" | "weight";

const KINDS: { key: LogKind; icon: string; label: string }[] = [
  { key: "hydration", icon: "💧", label: "Air" },
  { key: "sleep", icon: "🌙", label: "Tidur" },
  { key: "activity", icon: "👟", label: "Aktivitas" },
  { key: "mood", icon: "🙂", label: "Mood" },
  { key: "weight", icon: "⚖️", label: "Berat" },
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

  const done = (message: string, table: Parameters<typeof undoLog>[0], clientId: string) => {
    onClose();
    show({ message, onUndo: () => void undoLog(table, clientId) });
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
const input: React.CSSProperties = {
  minHeight: 48, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 15,
};
