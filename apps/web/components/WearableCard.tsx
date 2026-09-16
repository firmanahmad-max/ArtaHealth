"use client";
import { useEffect, useRef, useState } from "react";
import { WEARABLE_LABEL, type DailyRollup, type WearableType } from "@arta/core";
import { isWearableNativeReady, wearableDailyRollup, importWearableText } from "@/lib/wearable";
import { useMounted } from "@/lib/useMounted";

/**
 * Wearable / Health Connect (V3-7 · WR-1) — kartu status data pasif perangkat. Native (WR-2)
 * mengisi otomatis; sampai itu ada, jembatan WR-1b = IMPOR FILE (CSV/JSON) agar rollup bisa
 * tampil di web hari ini. Non-medis. Flag NEXT_PUBLIC_FEATURE_WEARABLE.
 */

const ICON: Record<WearableType, string> = {
  steps: "👟", heart_rate: "❤️", sleep: "😴", active_energy: "🔥", weight: "⚖️", spo2: "🫁",
};
const fmt = (r: DailyRollup): string =>
  `${r.value.toLocaleString("id-ID")}${r.unit && r.unit !== "count" ? ` ${r.unit}` : ""}`;

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function WearableCard() {
  const mounted = useMounted();
  const [today, setToday] = useState<DailyRollup[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () =>
    wearableDailyRollup().then((rows) => setToday(rows.filter((r) => r.day === todayKey())));

  useEffect(() => { if (mounted) void refresh(); }, [mounted]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Mengimpor…");
    try {
      const { imported, skipped } = await importWearableText(await file.text());
      await refresh();
      setStatus(imported > 0
        ? `Berhasil impor ${imported} sampel${skipped ? `, ${skipped} baris dilewati` : ""}.`
        : `Tak ada data valid ditemukan${skipped ? ` (${skipped} baris dilewati)` : ""}.`);
    } catch {
      setStatus("Gagal membaca file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const nativeReady = mounted && isWearableNativeReady();
  const hasData = (today?.length ?? 0) > 0;

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>⌚ Perangkat & Wearable</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Langkah, tidur & detak — otomatis di Android (Health Connect), atau impor file di web.
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
              : "Sinkronisasi otomatis tersedia di aplikasi Android. Di web, impor data dari file (CSV/JSON) untuk melihat rekap harianmu."}
          </p>
        </div>
      )}

      {!nativeReady && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={onFile} hidden />
          <button onClick={() => fileRef.current?.click()} style={importBtn}>⬆️ Impor dari file (CSV/JSON)</button>
          {status && <p style={{ fontSize: 10.5, color: "var(--ah-text-secondary)" }}>{status}</p>}
          <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)", lineHeight: 1.45 }}>
            Format: kolom <code>type,value,unit,start_at</code> (type = steps/heart_rate/sleep/active_energy/weight/spo2).
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
const importBtn: React.CSSProperties = {
  minHeight: 38, borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
