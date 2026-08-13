"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { formatHijri, SUNNAH_LABELS, type SunnahSchedule } from "@arta/core";
import { sunnahInfoToday, setSunnahSchedules, isFastingToday, setTodayFasting } from "@/lib/fasting";
import { useToast } from "@arta/design-system";

/**
 * Puasa sunnah sepanjang tahun (addendum-ramadan §3.2) — nilai retensi 11 bulan
 * di luar Ramadan. User memilih jadwal; bila jadwal jatuh hari ini, muncul
 * ajakan lembut menandai puasa. Tanggal Hijriah tampil sebagai konteks.
 * ⚠️ Hijriah tabular (±1–2 hari) — tanggal krusial tetap dikonfirmasi user (§4).
 */
export function SunnahScheduleCard() {
  const { show } = useToast();
  const info = useLiveQuery(() => sunnahInfoToday(), []);
  const fasting = useLiveQuery(() => isFastingToday(), []) ?? false;

  if (!info) return null;
  const selected = new Set(info.schedules);

  const toggle = async (s: SunnahSchedule) => {
    const next = new Set(selected);
    next.has(s) ? next.delete(s) : next.add(s);
    await setSunnahSchedules([...next]);
  };
  const markFasting = async () => {
    await setTodayFasting("fasting", info.hits[0] ?? "senin_kamis");
    show({ message: "Puasa sunnah hari ini ✓ 🌙" });
  };

  const suggestion = info.hits.length > 0 && !fasting;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌙 Puasa Sunnah</p>
        <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>🗓️ {formatHijri(info.hijri)}</span>
      </div>

      {suggestion && (
        <div style={hintBox}>
          <p style={{ fontSize: 12, color: "var(--ah-text-primary)", lineHeight: 1.5 }}>
            Hari ini jadwal puasa sunnah Anda: <b>{info.hits.map((h) => SUNNAH_LABELS[h]).join(", ")}</b>.
          </p>
          <button onClick={() => void markFasting()} style={hintBtn}>Tandai puasa hari ini</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(Object.keys(SUNNAH_LABELS) as SunnahSchedule[]).map((s) => {
          const on = selected.has(s);
          return (
            <button
              key={s}
              onClick={() => void toggle(s)}
              aria-pressed={on}
              style={{
                minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
                border: on ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
                background: on ? "var(--ah-gradient-soft)" : "transparent",
                color: on ? "var(--ah-text-primary)" : "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600,
              }}
            >
              {on ? "✓ " : ""}{SUNNAH_LABELS[s]}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Pilih jadwal yang Anda ikuti — mode puasa aktif otomatis di hari yang cocok.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const hintBox: React.CSSProperties = {
  background: "var(--ah-gradient-soft)", borderRadius: "var(--ah-r-inner)", padding: 12,
  display: "flex", flexDirection: "column", gap: 8,
};
const hintBtn: React.CSSProperties = {
  minHeight: 38, borderRadius: "var(--ah-r-full)", border: "none", alignSelf: "flex-start",
  padding: "0 14px", background: "var(--ah-gradient-hero)", color: "#fff",
  fontSize: 12, fontWeight: 700, cursor: "pointer",
};
