"use client";
import { useEffect, useRef, useState } from "react";
import { WEARABLE_LABEL, latestRollupDay, wearableDaySeries, type DailyRollup, type WearableType } from "@arta/core";
import { isWearableNativeReady, wearableDailyRollup, importWearableText, clearWearableData } from "@/lib/wearable";
import { useMounted } from "@/lib/useMounted";

/**
 * Wearable / Health Connect (V3-7 · WR-1) — kartu status data pasif perangkat. Native (WR-2)
 * mengisi otomatis; sampai itu ada, jembatan WR-1b = IMPOR FILE (CSV/JSON) agar rollup bisa
 * tampil di web hari ini. Non-medis. Flag NEXT_PUBLIC_FEATURE_WEARABLE.
 */

const ICON: Record<WearableType, string> = {
  steps: "👟", heart_rate: "❤️", sleep: "😴", active_energy: "🔥", weight: "⚖️", spo2: "🫁",
  sleep_light: "🌙", sleep_deep: "🛌", sleep_rem: "💤",
};
const fmt = (r: DailyRollup): string =>
  `${r.value.toLocaleString("id-ID")}${r.unit && r.unit !== "count" ? ` ${r.unit}` : ""}`;

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateLabel = (day: string): string =>
  day === todayKey() ? "hari ini" : new Date(`${day}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

const TREND_DAYS = 7;

export function WearableCard() {
  const mounted = useMounted();
  const [all, setAll] = useState<DailyRollup[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => wearableDailyRollup().then(setAll);

  useEffect(() => { if (mounted) void refresh(); }, [mounted]);

  const latest = all ? latestRollupDay(all) : null;
  const metrics = latest ? all!.filter((r) => r.day === latest) : [];
  const stepsSeries = latest ? wearableDaySeries(all!, "steps", latest, TREND_DAYS) : [];
  const hasStepsTrend = stepsSeries.some((p) => p.value != null);
  const stepsMax = Math.max(1, ...stepsSeries.map((p) => p.value ?? 0));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setStatus("Mengimpor…");
    try {
      let imported = 0, skipped = 0;
      for (const f of files) {
        const r = await importWearableText(await f.text());
        imported += r.imported; skipped += r.skipped;
      }
      await refresh();
      const suffix = skipped ? `, ${skipped} baris/sesi dilewati` : "";
      setStatus(imported > 0
        ? `Berhasil impor ${imported} sampel${suffix}.`
        : `Tak ada data valid ditemukan${skipped ? ` (${skipped} baris/sesi dilewati)` : ""}.`);
    } catch {
      setStatus("Gagal membaca file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setConfirmClear(false);
    const n = await clearWearableData();
    await refresh();
    setStatus(n > 0 ? `Data wearable dihapus (${n} sampel).` : "Tak ada data wearable untuk dihapus.");
  };

  const nativeReady = mounted && isWearableNativeReady();
  const hasData = metrics.length > 0;

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>⌚ Perangkat & Wearable</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Langkah, tidur & detak — otomatis di Android (Health Connect), atau impor file di web.
        </p>
      </div>

      {hasData ? (
        <>
          <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", marginTop: -4 }}>Data terbaru · {dateLabel(latest!)}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {metrics.map((r) => (
              <div key={r.type} style={metric}>
                <span style={{ fontSize: 15 }}>{ICON[r.type]}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)", lineHeight: 1.1 }}>{fmt(r)}</p>
                  <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)" }}>{WEARABLE_LABEL[r.type]}</p>
                </div>
              </div>
            ))}
          </div>
          {hasStepsTrend && (
            <div>
              <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", marginBottom: 4 }}>👟 Langkah · {TREND_DAYS} hari</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 42 }}>
                {stepsSeries.map((p) => (
                  <div key={p.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
                    title={`${dateLabel(p.day)}: ${p.value != null ? p.value.toLocaleString("id-ID") + " langkah" : "tak ada data"}`}>
                    <div style={{ width: "100%", height: Math.round(((p.value ?? 0) / stepsMax) * 34) + (p.value != null ? 4 : 2),
                      background: p.value != null ? "var(--ah-accent)" : "var(--ah-border)", borderRadius: 3, opacity: p.value != null ? 1 : 0.5 }} />
                    <span style={{ fontSize: 7.5, color: "var(--ah-text-tertiary)" }}>{new Date(`${p.day}T00:00:00`).getDate()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
          <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={onFile} multiple hidden />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => fileRef.current?.click()} style={{ ...importBtn, flex: 1 }}>⬆️ Impor dari file (CSV/JSON)</button>
            {hasData && (
              <button onClick={onClear} onBlur={() => setConfirmClear(false)} style={{ ...importBtn, flex: "0 0 auto", color: confirmClear ? "var(--ah-score-low)" : "var(--ah-text-tertiary)", borderColor: confirmClear ? "var(--ah-score-low)" : "var(--ah-border)" }}>
                {confirmClear ? "Yakin?" : "Reset"}
              </button>
            )}
          </div>
          {status && <p style={{ fontSize: 10.5, color: "var(--ah-text-secondary)" }}>{status}</p>}
          <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)", lineHeight: 1.45 }}>
            Terima file Google Fit (Takeout → "Daily activity metrics.csv" untuk langkah/detak/berat, atau file
            sesi tidur "All Sessions" — bisa pilih banyak) atau format sederhana kolom{" "}
            <code>type,value,unit,start_at</code> (type = steps/heart_rate/sleep/active_energy/weight/spo2).
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
