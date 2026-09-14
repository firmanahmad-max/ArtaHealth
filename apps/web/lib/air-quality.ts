"use client";
import { classifyUsAqi, type AqiInfo } from "@arta/core";

/**
 * Radar Sehat — ambil kualitas udara dari Open-Meteo Air Quality (GRATIS, tanpa API key,
 * CORS-friendly) untuk lokasi pengguna, lalu klasifikasi via engine core. On-device fetch;
 * turun anggun saat offline/izin lokasi ditolak (fallback Jakarta). Non-medis.
 */

const DEFAULT_LOC = { lat: -6.2088, lon: 106.8456, name: "Jakarta (perkiraan)" };

export interface AirQualityReading {
  usAqi: number;
  pm25: number | null;
  pm10: number | null;
  time: string;
  info: AqiInfo;
  lat: number;
  lon: number;
  approxLocation: boolean;   // true bila pakai fallback (izin lokasi ditolak)
}
export type AqResult = { ok: true; reading: AirQualityReading } | { ok: false; message: string };

/** Koordinat pengguna via geolocation; fallback Jakarta bila ditolak/tak didukung. */
async function getLocation(): Promise<{ lat: number; lon: number; approx: boolean }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { lat: DEFAULT_LOC.lat, lon: DEFAULT_LOC.lon, approx: true };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, approx: false }),
      () => resolve({ lat: DEFAULT_LOC.lat, lon: DEFAULT_LOC.lon, approx: true }),
      { timeout: 8000, maximumAge: 30 * 60_000 },
    );
  });
}

/** Ambil & klasifikasikan kualitas udara. `lat/lon` opsional (default: lokasi perangkat). */
export async function fetchAirQuality(lat?: number, lon?: number): Promise<AqResult> {
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (!online) return { ok: false, message: "Perlu koneksi internet untuk memuat kualitas udara." };

  const loc = lat != null && lon != null ? { lat, lon, approx: false } : await getLocation();
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&current=us_aqi,pm2_5,pm10&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, message: "Gagal memuat data kualitas udara. Coba lagi." };
    const d = await res.json();
    const cur = (d?.current ?? {}) as { us_aqi?: number; pm2_5?: number; pm10?: number; time?: string };
    const usAqi = Number(cur.us_aqi);
    if (!Number.isFinite(usAqi)) return { ok: false, message: "Data AQI tak tersedia untuk lokasi ini." };
    return {
      ok: true,
      reading: {
        usAqi: Math.round(usAqi),
        pm25: typeof cur.pm2_5 === "number" ? cur.pm2_5 : null,
        pm10: typeof cur.pm10 === "number" ? cur.pm10 : null,
        time: cur.time ?? "",
        info: classifyUsAqi(usAqi),
        lat: loc.lat, lon: loc.lon, approxLocation: loc.approx,
      },
    };
  } catch {
    return { ok: false, message: "Gagal memuat kualitas udara (jaringan)." };
  }
}
