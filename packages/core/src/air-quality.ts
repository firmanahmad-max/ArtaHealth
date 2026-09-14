/**
 * Radar Sehat — kualitas udara (backlog). Klasifikasi DETERMINISTIK indeks kualitas udara
 * (US AQI, breakpoints EPA) → kategori + saran tindakan. Data dari Open-Meteo Air Quality
 * (gratis, tanpa API key). Non-medis: saran umum kesadaran lingkungan, bukan diagnosis.
 */

export type AqiCategory = "good" | "moderate" | "sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";

export interface AqiInfo {
  category: AqiCategory;
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";  // untuk warna UI (dipetakan di klien)
  range: string;                               // "0–50"
  advice: string;
}

const TABLE: { max: number; info: Omit<AqiInfo, "range"> & { lo: number } }[] = [
  { max: 50, info: { lo: 0, category: "good", label: "Baik", tone: "good",
    advice: "Kualitas udara baik. Nikmati aktivitas luar seperti biasa." } },
  { max: 100, info: { lo: 51, category: "moderate", label: "Sedang", tone: "warn",
    advice: "Umumnya aman. Kelompok sangat sensitif sebaiknya perhatikan gejala saat aktivitas berat di luar." } },
  { max: 150, info: { lo: 101, category: "sensitive", label: "Tidak sehat bagi kelompok sensitif", tone: "warn",
    advice: "Kelompok sensitif (anak, lansia, penyakit paru/jantung, ibu hamil) kurangi aktivitas berat di luar; pertimbangkan masker." } },
  { max: 200, info: { lo: 151, category: "unhealthy", label: "Tidak sehat", tone: "bad",
    advice: "Batasi aktivitas luar. Kenakan masker (mis. KN95) bila harus keluar; tutup jendela; nyalakan penyaring udara bila ada." } },
  { max: 300, info: { lo: 201, category: "very_unhealthy", label: "Sangat tidak sehat", tone: "bad",
    advice: "Hindari aktivitas luar. Tetap di dalam ruangan dengan udara tersaring; pakai masker bila terpaksa keluar." } },
  { max: Infinity, info: { lo: 301, category: "hazardous", label: "Berbahaya", tone: "bad",
    advice: "Darurat kesehatan udara. Tetap di dalam ruangan; ikuti arahan otoritas setempat. Segera cari bantuan bila sesak." } },
];

/** Klasifikasikan nilai US AQI (0..500+) → kategori + saran. */
export function classifyUsAqi(aqi: number): AqiInfo {
  const v = Math.max(0, Math.round(aqi));
  const row = TABLE.find((r) => v <= r.max) ?? TABLE[TABLE.length - 1]!;
  const hi = row.max === Infinity ? "301+" : String(row.max);
  return {
    category: row.info.category, label: row.info.label, tone: row.info.tone,
    range: `${row.info.lo}–${hi}`, advice: row.info.advice,
  };
}

/** Apakah kategori tergolong perlu perhatian (untuk memutuskan menampilkan peringatan). */
export function aqiNeedsAttention(category: AqiCategory): boolean {
  return category !== "good" && category !== "moderate";
}
