"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import { getFastingSettings, enableRamadan, disableRamadan, ramadanProgress } from "@/lib/fasting";

/**
 * Aktivasi Mode Ramadan (addendum-ramadan §3.1) + progres puasa (§7).
 * Tanggal DIKONFIRMASI user (sidang isbat — aplikasi tak sok tahu, §4). Saat
 * aktif, seluruh engine hari itu default puasa & menampilkan "X/Y hari puasa"
 * sebagai pencapaian (hari not_fasting transparan, bukan kecacatan).
 */

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};

export function RamadanSetupCard() {
  const { show } = useToast();
  const settings = useLiveQuery(() => getFastingSettings(), []);
  const progress = useLiveQuery(() => ramadanProgress(), []);
  const today = isoDate(new Date());
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 29));

  if (!settings) return null;

  if (settings.ramadanEnabled) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌙 Mode Ramadan aktif</p>
          <button onClick={() => void disable()} style={ghost}>Nonaktifkan</button>
        </div>
        {progress && progress.elapsed > 0 && (
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ah-text-primary)", fontVariantNumeric: "tabular-nums" }}>
            🔥 {progress.fasted}/{progress.elapsed} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ah-text-secondary)" }}>hari puasa</span>
          </p>
        )}
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>{settings.ramadanStart} – {settings.ramadanEnd}</p>
      </div>
    );
  }

  const activate = async () => {
    if (end < start) { show({ variant: "info", message: "Tanggal selesai harus setelah mulai." }); return; }
    await enableRamadan(start, end);
    show({ message: "Mode Ramadan aktif 🌙" });
  };
  const disable = async () => { await disableRamadan(); show({ message: "Mode Ramadan dinonaktifkan" }); };

  return (
    <div style={card}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌙 Ramadan sebentar lagi</p>
      <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
        Siapkan mode puasa? Seluruh pengingat & skor akan menyesuaikan konteks puasa.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={label}>Mulai
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} />
        </label>
        <label style={label}>Selesai
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} />
        </label>
      </div>
      <button onClick={() => void activate()} style={primary}>Aktifkan Mode Ramadan</button>
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Tanggal dikonfirmasi Anda (mengikuti sidang isbat) — bisa diubah kapan saja.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(139,92,246,0.14), rgba(34,211,238,0.10))",
  border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-card)",
  padding: 14, display: "flex", flexDirection: "column", gap: 10,
};
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ah-text-secondary)" };
const input: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 14,
};
const primary: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghost: React.CSSProperties = {
  minHeight: 30, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
