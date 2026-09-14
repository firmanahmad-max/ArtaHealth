"use client";
import { useEffect, useState } from "react";
import { WEARABLE_LABEL, type DailyRollup, type WearableType } from "@arta/core";
import { isWearableNativeReady, wearableDailyRollup } from "@/lib/wearable";
import { useMounted } from "@/lib/useMounted";

/**
 * Wearable / Health Connect (V3-7 · WR-1) — kartu status data pasif perangkat. Di web PWA
 * jembatan native belum ada → INERT: tampilkan keadaan "sambungkan di Android" tanpa
 * request/janji. Saat native (WR-2) mengisi sampel, tampilkan rollup hari ini (deterministik).
 * Non-medis. Flag NEXT_PUBLIC_FEATURE_WEARABLE.
 */

const ICON: Record<WearableType, string> = {
  steps: "👟", heart_rate: "❤️", sleep: "😴", active_energy: "🔥", weight: "⚖️", spo2: "🫁",
};
const fmt = (r: DailyRollup): string =>
  `${r.value.toLocaleString("id-ID")}${r.unit && r.unit !== "count" ? ` ${r.unit}` : ""}`;

export function WearableCard() {
  const mounted = useMounted();
  const [today, setToday] = useState<DailyRollup[] | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    void wearableDailyRollup().then((rows) => setToday(rows.filter((r) => r.day === key)));
  }, [mounted]);

  const nativeReady = mounted && isWearableNativeReady();
  const hasData = (today?.length ?? 0) > 0;

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>⌚ Perangkat & Wearable</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Langkah, tidur & detak dari Health Connect — otomatis, tanpa input manual.
        </p>
      </div>

      {hasData ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {today!.map((r) => (
            <div key={r.type} style={metric}>
              <span style={{ fontSize: 15 }}>{ICON[r.type]}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)", lineHeight: 1.1 }}>{fmt(r)}</p>
                <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)" }}>{WEARABLE_LABEL[r.type]}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={emptyBox}>
          <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
            {nativeReady
              ? "Belum ada data hari ini. Pastikan izin Health Connect aktif dan perangkat tersinkron."
              : "Sinkronisasi otomatis tersedia di aplikasi Android (Health Connect). Di web, catat aktivitas & tidur secara manual seperti biasa."}
          </p>
        </div>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Data perangkat dipakai apa adanya untuk kesadaran diri (satu sumber per metrik agar tak dobel-hitung), bukan alat medis.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const metric: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
  borderRadius: "var(--ah-r-inner)", background: "var(--ah-surface-2)", border: "1px solid var(--ah-border)",
};
const emptyBox: React.CSSProperties = {
  borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
  background: "var(--ah-surface-2)", border: "1px dashed var(--ah-border)",
};
