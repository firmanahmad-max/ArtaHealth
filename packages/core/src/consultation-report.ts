/**
 * Mode Konsultasi — Laporan Dokter (V3-1, MK-1). Engine DETERMINISTIK yang merangkai
 * data yang SUDAH dicatat pengguna (biomarker/tren, Early Warning, obat, gaya hidup,
 * gizi, dokumen) menjadi struktur laporan rapi untuk dibawa ke dokter.
 *
 * BUKAN diagnosis, BUKAN interpretasi klinis — hanya menyajikan data + tren apa adanya
 * dengan rujukan guideline yang sudah dipakai app (dokter yang menafsirkan). Semua data
 * diteruskan oleh pemanggil (lib) — engine tak menyentuh Dexie/AI → mudah diuji.
 */

export const CONDITION_LABEL_ID: Record<string, string> = {
  hypertension: "Hipertensi", diabetes: "Diabetes",
  dyslipidemia: "Dislipidemia", hyperuricemia: "Hiperurisemia",
};

export const CONSULTATION_DISCLAIMER =
  "Laporan ini disiapkan oleh pemilik akun via ArtaHealth dari data yang dicatat sendiri. " +
  "Bukan dokumen medis resmi, bukan diagnosis. Angka & tren disajikan apa adanya untuk membantu " +
  "diskusi dengan tenaga kesehatan — penafsiran klinis sepenuhnya oleh dokter.";

// ===== Ringkasan deret waktu =====

export interface SeriesPoint { t: string; value: number; }

export interface SeriesSummary {
  count: number;
  latest: number | null;
  latestAtISO: string | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  direction: "rising" | "falling" | "flat" | "na";
}

/** Ringkas deret numerik: jumlah, terkini, min/max/rata-rata, arah tren (sepertiga awal vs akhir). */
export function summarizeSeries(points: SeriesPoint[]): SeriesSummary {
  const clean = points
    .filter((p) => Number.isFinite(p.value) && !Number.isNaN(new Date(p.t).getTime()))
    .slice()
    .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  const n = clean.length;
  if (n === 0) return { count: 0, latest: null, latestAtISO: null, min: null, max: null, avg: null, direction: "na" };

  const vals = clean.map((p) => p.value);
  const sum = vals.reduce((s, v) => s + v, 0);
  const avg = sum / n;
  const last = clean[n - 1]!;

  let direction: SeriesSummary["direction"] = "na";
  if (n >= 2) {
    const k = Math.max(1, Math.floor(n / 3));
    const firstAvg = vals.slice(0, k).reduce((s, v) => s + v, 0) / k;
    const lastAvg = vals.slice(n - k).reduce((s, v) => s + v, 0) / k;
    const delta = lastAvg - firstAvg;
    const rel = delta / (Math.abs(avg) || 1);
    direction = Math.abs(rel) < 0.02 ? "flat" : delta > 0 ? "rising" : "falling";
  }

  return {
    count: n, latest: last.value, latestAtISO: last.t,
    min: Math.min(...vals), max: Math.max(...vals), avg, direction,
  };
}

/** Kepatuhan obat (persen dosis terjadwal yang ditandai diminum). null bila tak ada jadwal. */
export function adherencePct(scheduled: number, taken: number): number | null {
  if (scheduled <= 0) return null;
  return Math.round((Math.min(taken, scheduled) / scheduled) * 100);
}

// ===== Struktur laporan =====

export interface ReportPatient {
  name?: string;
  age?: number | null;
  sex?: "male" | "female" | null;
  conditions: string[]; // label siap-tampil
}

export interface ReportRange { fromISO: string; toISO: string; days: number; }

export interface ReportBiomarker {
  key: string;            // 'bp' | 'glucose:gdp' | 'uric_acid' | ...
  label: string;
  unit: string;
  latestValue: string;    // sudah diformat ("150/95", "126")
  latestAtISO: string;
  zoneLabel?: string;     // dari klasifikasi guideline
  guidelineRef?: string;
  summary?: SeriesSummary; // untuk metrik nilai-tunggal (bukan BP)
}

export interface ReportWarning { label: string; text: string; severity: string; }
export interface ReportMedication { name: string; schedule: string; adherencePct?: number | null; }
export interface ReportLifestyle {
  sleepAvgH?: number | null;
  hydrationAvgMl?: number | null;
  activityAvgMin?: number | null;
}
export interface ReportNutrition { sodiumAvgMg?: number | null; sugarAvgG?: number | null; note?: string; }
export interface ReportDocument { title: string; dateISO: string | null; kind?: string; }

export interface ConsultationReportInput {
  patient: ReportPatient;
  range: ReportRange;
  biomarkers: ReportBiomarker[];
  warnings: ReportWarning[];
  medications: ReportMedication[];
  lifestyle: ReportLifestyle | null;
  nutrition?: ReportNutrition | null;
  documents: ReportDocument[];
  generatedAtISO: string;
}

export type ReportSection =
  | "biomarkers" | "warnings" | "medications" | "lifestyle" | "nutrition" | "documents";

export interface ConsultationReport extends ConsultationReportInput {
  sections: ReportSection[]; // bagian yang punya data, urut tampil
  isEmpty: boolean;          // tak ada data bermakna sama sekali
  disclaimer: string;
}

const SECTION_ORDER: ReportSection[] = [
  "biomarkers", "warnings", "medications", "lifestyle", "nutrition", "documents",
];

const lifestyleHasData = (l: ReportLifestyle | null): boolean =>
  !!l && (l.sleepAvgH != null || l.hydrationAvgMl != null || l.activityAvgMin != null);

const nutritionHasData = (nut: ReportNutrition | null | undefined): boolean =>
  !!nut && (nut.sodiumAvgMg != null || nut.sugarAvgG != null);

/** Rakit laporan final: tentukan bagian berisi + urutan + status kosong + disclaimer. */
export function buildConsultationReport(input: ConsultationReportInput): ConsultationReport {
  const present: Record<ReportSection, boolean> = {
    biomarkers: input.biomarkers.length > 0,
    warnings: input.warnings.length > 0,
    medications: input.medications.length > 0,
    lifestyle: lifestyleHasData(input.lifestyle),
    nutrition: nutritionHasData(input.nutrition),
    documents: input.documents.length > 0,
  };
  const sections = SECTION_ORDER.filter((s) => present[s]);
  return {
    ...input,
    sections,
    isEmpty: sections.length === 0,
    disclaimer: CONSULTATION_DISCLAIMER,
  };
}
