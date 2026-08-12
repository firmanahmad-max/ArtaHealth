"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatTime } from "@arta/core";
import { prayerTimesFor, isFastingToday } from "@/lib/fasting";
import { useMounted } from "@/lib/useMounted";

/**
 * Header sadar-puasa (addendum-ramadan §6.1): countdown berbuka saat berpuasa,
 * hitung mundur imsak menjelang sahur, dan sambutan berbuka setelah maghrib.
 * Digate useMounted (nilai bergantung-waktu) agar tak memicu hydration mismatch.
 * Hanya render bila hari ini berstatus puasa.
 */

const nowMinutes = (): number => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const dur = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
};

export function RamadanHeader() {
  const mounted = useMounted();
  const fasting = useLiveQuery(() => isFastingToday(), []);
  const times = useLiveQuery(() => prayerTimesFor(), []);
  const [now, setNow] = useState(-1);

  useEffect(() => {
    setNow(nowMinutes());
    const id = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!mounted || now < 0 || !fasting || !times) return null;

  let text: string;
  if (now < times.imsak) {
    text = `🌙 Imsak ${formatTime(times.imsak)} · ${dur(times.imsak - now)} lagi`;
  } else if (now < times.maghrib) {
    text = `🌙 Berbuka ${formatTime(times.maghrib)} · ${dur(times.maghrib - now)} lagi`;
  } else if (now < times.isha) {
    text = "Selamat berbuka! Awali dengan air putih 💧";
  } else {
    return null; // setelah isya kembali normal
  }

  return (
    <div style={banner} role="status">
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{text}</span>
    </div>
  );
}

const banner: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(139,92,246,0.22), rgba(251,146,60,0.18))",
  border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)",
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--ah-text-primary)",
  textAlign: "center",
};
