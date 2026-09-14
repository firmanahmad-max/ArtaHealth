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
