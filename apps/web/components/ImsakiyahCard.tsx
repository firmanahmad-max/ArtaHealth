"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatTime, type PrayerName } from "@arta/core";
import { useToast } from "@arta/design-system";
import {
  getFastingSettings, prayerTimesFor, setLocation, setTimeCorrection, captureGeolocation, hasLocation,
} from "@/lib/fasting";

/**
 * Kartu Jadwal Imsakiyah (addendum-ramadan §3.1/§6.7). Menampilkan waktu salat +
 * imsak hari ini dari koordinat tersimpan, dengan penangkapan lokasi (kota / GPS)
 * dan koreksi ihtiyati ±menit. Kartu ini juga sarana validasi vs Kemenag (§10):
 * user membandingkan angka & menyetel koreksi sampai cocok ±2 menit.
 */

const CITIES: { key: string; label: string; lat: number; lng: number }[] = [
  { key: "jakarta", label: "Jakarta", lat: -6.2088, lng: 106.8456 },
  { key: "bandung", label: "Bandung", lat: -6.9147, lng: 107.6098 },
  { key: "surabaya", label: "Surabaya", lat: -7.2575, lng: 112.7521 },
  { key: "medan", label: "Medan", lat: 3.5952, lng: 98.6722 },
  { key: "makassar", label: "Makassar", lat: -5.1477, lng: 119.4327 },
  { key: "samarinda", label: "Samarinda", lat: -0.5017, lng: 117.1536 },
  { key: "banjarmasin", label: "Banjarmasin", lat: -3.3186, lng: 114.5944 },
  { key: "pontianak", label: "Pontianak", lat: -0.0263, lng: 109.3425 },
];

const SCHEDULE_ROWS: { key: PrayerName; label: string }[] = [
  { key: "imsak", label: "Imsak" }, { key: "fajr", label: "Subuh" }, { key: "sunrise", label: "Terbit" },
  { key: "dhuhr", label: "Dzuhur" }, { key: "asr", label: "Asar" }, { key: "maghrib", label: "Maghrib" },
  { key: "isha", label: "Isya" },
];

export function ImsakiyahCard() {
  const { show } = useToast();
  const settings = useLiveQuery(() => getFastingSettings(), []);
  const times = useLiveQuery(() => prayerTimesFor(), []);
  const [busy, setBusy] = useState(false);

  if (!settings || !times) return null;

  const located = hasLocation(settings);
  const matchedCity = located
    ? CITIES.find((c) => Math.abs(c.lat - (settings.latitude ?? 0)) < 1e-4 && Math.abs(c.lng - (settings.longitude ?? 0)) < 1e-4)
    : undefined;
  const locationLabel = !located
    ? "Default: Jakarta — atur lokasi Anda"
    : matchedCity?.label ?? `Lokasi Anda (${settings.latitude?.toFixed(2)}, ${settings.longitude?.toFixed(2)})`;

  const pickCity = async (key: string) => {
    const c = CITIES.find((x) => x.key === key);
    if (c) await setLocation(c.lat, c.lng);
  };
  const useGps = async () => {
    setBusy(true);
    try {
      const { latitude, longitude } = await captureGeolocation();
      await setLocation(latitude, longitude);
      show({ message: "Lokasi diperbarui dari GPS" });
    } catch {
      show({ variant: "info", message: "Tidak bisa mengambil lokasi. Pilih kota secara manual." });
    } finally { setBusy(false); }
  };
  const bump = async (name: PrayerName, delta: number) => {
    await setTimeCorrection({ [name]: (settings.timeCorrection[name] ?? 0) + delta });
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌙 Jadwal Imsakiyah</p>
        <button onClick={() => void useGps()} disabled={busy} style={gpsBtn}>📍 Lokasi saya</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)", flex: 1, minWidth: 120 }}>{locationLabel}</span>
        <select
          value={matchedCity?.key ?? ""}
          onChange={(e) => void pickCity(e.target.value)}
          aria-label="Pilih kota"
          style={select}
        >
          <option value="" disabled>Pilih kota…</option>
          {CITIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {SCHEDULE_ROWS.map((r) => (
          <div key={r.key} style={row}>
            <span style={{ fontSize: 12, color: "var(--ah-text-secondary)" }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {formatTime(times[r.key])}
            </span>
          </div>
        ))}
      </div>

      <details>
        <summary style={{ fontSize: 11, color: "var(--ah-text-tertiary)", cursor: "pointer" }}>
          Koreksi ihtiyati (cocokkan dengan jadwal Kemenag)
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {(["imsak", "maghrib"] as const).map((name) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--ah-text-secondary)", flex: 1, textTransform: "capitalize" }}>{name}</span>
              <button onClick={() => void bump(name, -1)} style={stepBtn} aria-label={`${name} kurang 1 menit`}>−</button>
              <span style={{ fontSize: 12, width: 44, textAlign: "center", fontVariantNumeric: "tabular-nums", color: "var(--ah-text-primary)" }}>
                {(settings.timeCorrection[name] ?? 0) > 0 ? "+" : ""}{settings.timeCorrection[name] ?? 0} mnt
              </span>
              <button onClick={() => void bump(name, 1)} style={stepBtn} aria-label={`${name} tambah 1 menit`}>+</button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "8px 12px",
};
const gpsBtn: React.CSSProperties = {
  minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};
const select: React.CSSProperties = {
  minHeight: 32, padding: "0 8px", borderRadius: "var(--ah-r-chip)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", fontSize: 12,
};
const stepBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", fontSize: 16, fontWeight: 700, cursor: "pointer",
};
