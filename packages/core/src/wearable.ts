/**
 * Wearable / Health Connect (V3-7 · WR-1) — engine DETERMINISTIK untuk data pasif dari
 * perangkat: dedup sampel, rollup harian per metrik, & pemilihan sumber (wearable vs manual)
 * agar tak dobel-hitung di skor. Pengambilan native (Health Connect/HealthKit) = WR-2 (butuh
 * Capacitor + device). Lapisan ini murni & teruji; agnostik sumber. Non-medis.
 */

export type WearableType = "steps" | "heart_rate" | "sleep" | "active_energy" | "weight" | "spo2";
export type WearableSource = "health_connect" | "healthkit";

export interface WearableSample {
  externalId: string;        // id sampel dari platform → dedup idempoten
  type: WearableType;
  value: number;             // langkah, bpm, menit tidur, kkal, kg, %
  unit: string;
  startAt: string;           // ISO
  endAt?: string;            // ISO (opsional)
  source: WearableSource;
}

/** Hilangkan sampel duplikat berdasarkan (source, externalId); ambil kemunculan terakhir. */
export function dedupeSamples(samples: WearableSample[]): WearableSample[] {
  const map = new Map<string, WearableSample>();
  for (const s of samples) {
    if (!s.externalId || !Number.isFinite(s.value)) continue;
    map.set(`${s.source}:${s.externalId}`, s);
  }
  return [...map.values()];
}

/** Cara agregasi per jenis metrik dalam satu hari. */
const AGG: Record<WearableType, "sum" | "avg" | "last"> = {
  steps: "sum", active_energy: "sum", sleep: "sum",
  heart_rate: "avg", spo2: "avg", weight: "last",
};

const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface DailyRollup {
  day: string;
  type: WearableType;
  value: number;
  unit: string;
  n: number;          // jumlah sampel
}

/** Rollup harian per (hari lokal, jenis) sesuai aturan agregasi. Deterministik, urut hari lalu jenis. */
export function rollupDaily(samples: WearableSample[]): DailyRollup[] {
  const groups = new Map<string, WearableSample[]>();
  for (const s of dedupeSamples(samples)) {
    const key = `${localDay(s.startAt)}|${s.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  const out: DailyRollup[] = [];
  for (const [key, rows] of groups) {
    const [day, type] = key.split("|") as [string, WearableType];
    const vals = rows.map((r) => r.value);
    let value: number;
    if (AGG[type] === "sum") value = vals.reduce((a, b) => a + b, 0);
    else if (AGG[type] === "avg") value = vals.reduce((a, b) => a + b, 0) / vals.length;
    else { // last: sampel dengan waktu mulai terbaru
      value = rows.slice().sort((a, b) => a.startAt.localeCompare(b.startAt))[rows.length - 1]!.value;
    }
    out.push({ day, type, value: Math.round(value * 10) / 10, unit: rows[0]!.unit, n: rows.length });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.type.localeCompare(b.type));
}

/**
 * Pilih SATU nilai per metrik/hari saat ada dari wearable & manual → hindari dobel-hitung.
 * Default utamakan wearable bila tersedia; jika salah satu null pakai yang ada.
 */
export function chooseSource(
  wearable: number | null, manual: number | null, prefer: "wearable" | "manual" = "wearable",
): number | null {
  if (wearable == null) return manual;
  if (manual == null) return wearable;
  return prefer === "wearable" ? wearable : manual;
}

export const WEARABLE_LABEL: Record<WearableType, string> = {
  steps: "Langkah", heart_rate: "Detak jantung istirahat", sleep: "Tidur",
  active_energy: "Energi aktif", weight: "Berat", spo2: "SpO₂",
};

// ===== WR-1b: impor manual dari file (jembatan non-native) =====
// Jembatan sementara tanpa Capacitor/device (docs/addendum-wearable.md §8): pengguna mengimpor
// data dari file CSV/JSON (mis. hasil export Health Connect/Google Fit yang dikonversi ke format
// sederhana ini). Parser DETERMINISTIK & aman: baris tak valid dilewati, bukan menggagalkan impor.

export const WEARABLE_TYPES: WearableType[] = ["steps", "heart_rate", "sleep", "active_energy", "weight", "spo2"];
const WEARABLE_SOURCES: WearableSource[] = ["health_connect", "healthkit"];
const DEFAULT_UNIT: Record<WearableType, string> = {
  steps: "count", heart_rate: "bpm", sleep: "min", active_energy: "kcal", weight: "kg", spo2: "%",
};

export interface WearableImportResult {
  samples: WearableSample[];
  skipped: number;      // baris/objek yang dilewati karena tak valid
}

/** Ubah satu objek mentah (dari JSON/CSV) → WearableSample, atau null bila tak valid. */
function coerceSample(raw: Record<string, unknown>): WearableSample | null {
  const type = String(raw.type ?? "").trim().toLowerCase() as WearableType;
  if (!WEARABLE_TYPES.includes(type)) return null;
  const value = Number(raw.value);
  if (!Number.isFinite(value)) return null;
  const startAt = String(raw.startAt ?? raw.start_at ?? "").trim();
  if (!startAt || Number.isNaN(Date.parse(startAt))) return null;
  const srcRaw = String(raw.source ?? "").trim().toLowerCase();
  const source: WearableSource = (WEARABLE_SOURCES as string[]).includes(srcRaw) ? (srcRaw as WearableSource) : "health_connect";
  const unit = String(raw.unit ?? "").trim() || DEFAULT_UNIT[type];
  const endRaw = String(raw.endAt ?? raw.end_at ?? "").trim();
  const endAt = endRaw && !Number.isNaN(Date.parse(endRaw)) ? endRaw : undefined;
  // externalId dari file bila ada; jika tidak, turunkan deterministik (idempoten saat re-impor)
  const extRaw = String(raw.externalId ?? raw.external_id ?? "").trim();
  const externalId = extRaw || `imp-${type}-${startAt}`;
  return { externalId, type, value, unit, startAt, endAt, source };
}

/** Parse baris CSV sederhana (tanpa koma ber-tanda-kutip). */
function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const obj: Record<string, unknown> = {};
    header.forEach((h, i) => { obj[h] = (cells[i] ?? "").trim(); });
    return obj;
  });
}

/**
 * Impor sampel wearable dari teks CSV atau JSON. Diterima:
 * - JSON: array objek {type,value,unit?,startAt|start_at,endAt?,source?,externalId?}
 * - CSV: header `type,value,unit,start_at,end_at,source,external_id` (kolom by nama, urut bebas)
 * Baris tak valid (jenis/nilai/tanggal salah) DILEWATI (dihitung di `skipped`). Non-medis.
 */
export function parseWearableImport(text: string): WearableImportResult {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { samples: [], skipped: 0 };
  let rows: Record<string, unknown>[];
  if (trimmed[0] === "[" || trimmed[0] === "{") {
    try {
      const parsed = JSON.parse(trimmed);
      rows = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { samples?: unknown }).samples) ? (parsed as { samples: Record<string, unknown>[] }).samples : [parsed];
    } catch {
      return { samples: [], skipped: 0 };
    }
  } else {
    // CSV: format sederhana bila ada kolom type&value; selain itu coba format Google Fit (Takeout).
    const header = (trimmed.split(/\r?\n/)[0] ?? "").split(",").map((h) => h.trim().toLowerCase());
    if (!(header.includes("type") && header.includes("value"))) return parseGoogleFitDailyCsv(trimmed);
    rows = parseCsv(trimmed);
  }
  const samples: WearableSample[] = [];
  let skipped = 0;
  for (const r of rows) {
    const s = coerceSample(r as Record<string, unknown>);
    if (s) samples.push(s); else skipped++;
  }
  return { samples, skipped };
}

// ===== Konverter Google Fit (Takeout) =====
// "Daily activity metrics.csv" dari Google Takeout: satu baris per tanggal dengan kolom mis.
// "Date, Step count, Calories (kcal), Average heart rate (bpm), Average weight (kg), ...".
// Dipetakan ke sampel harian (start_at = tengah malam lokal tanggal itu). Kolom dicocokkan
// per-nama (substring, case-insensitive) agar tahan variasi versi/locale ISO.

interface GfitMetric { type: WearableType; unit: string; match: (h: string) => boolean }
const GFIT_METRICS: GfitMetric[] = [
  { type: "steps", unit: "count", match: (h) => h.includes("step count") || h === "steps" },
  { type: "active_energy", unit: "kcal", match: (h) => h.includes("calories") },
  // "average" spesifik → hindari tertukar dgn Max/Min heart rate atau Heart Points/Minutes & Max/Min weight
  { type: "heart_rate", unit: "bpm", match: (h) => h.includes("average heart rate") },
  { type: "weight", unit: "kg", match: (h) => h.includes("average weight") },
];

/**
 * Konversi CSV "Daily activity metrics" Google Fit (Takeout) → sampel wearable. Butuh kolom
 * bertanda "Date" (ISO YYYY-MM-DD) + ≥1 kolom metrik dikenal. Sel kosong/non-angka dilewati;
 * `skipped` = baris yang tak menghasilkan sampel (tanggal invalid / semua metrik kosong).
 */
export function parseGoogleFitDailyCsv(text: string): WearableImportResult {
  const rows = parseCsv((text ?? "").trim());
  if (rows.length === 0) return { samples: [], skipped: 0 };
  const keys = Object.keys(rows[0]!);
  const dateKey = keys.find((k) => k.includes("date"));
  if (!dateKey) return { samples: [], skipped: rows.length };
  const cols = GFIT_METRICS
    .map((m) => ({ m, key: keys.find((k) => m.match(k)) }))
    .filter((x): x is { m: GfitMetric; key: string } => !!x.key);
  const samples: WearableSample[] = [];
  let skipped = 0;
  for (const row of rows) {
    const date = String(row[dateKey] ?? "").trim();
    if (!date || Number.isNaN(Date.parse(date))) { skipped++; continue; }
    let produced = 0;
    for (const { m, key } of cols) {
      const raw = String(row[key] ?? "").trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      samples.push({
        externalId: `gfit-${m.type}-${date}`, type: m.type, value, unit: m.unit,
        startAt: `${date}T00:00:00`, source: "health_connect",
      });
      produced++;
    }
    if (produced === 0) skipped++;
  }
  return { samples, skipped };
}
