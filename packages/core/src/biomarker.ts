/**
 * Biomarker Engine — deterministik, BUKAN LLM (addendum-silent-killer.md §3).
 *
 * Prinsip:
 *  1. Klasifikasi = nilai → band via TABEL AMBANG BER-VERSI (biomarker_bands),
 *     di-*inject* ke engine (bukan hardcoded) agar bisa diperbarui setelah
 *     review medis tanpa mengubah kode. DEFAULT_BIOMARKER_BANDS di bawah hanya
 *     cermin seed migration 0010 untuk bootstrap offline & unit test.
 *  2. Tekanan darah: klasifikasi mengikuti KATEGORI TERTINGGI sistolik/diastolik.
 *  3. Gula darah: ambang berbeda per KONTEKS (gdp/gds/pp2/hba1c).
 *  4. Red-flag (kegawatan akut) adalah aturan KESELAMATAN — ambangnya konstanta
 *     di kode (fail-safe), bukan config yang bisa tergeser. Pola sama dgn AI
 *     Safety Guard: keselamatan tidak boleh bergantung pada data yang bisa salah.
 *
 * ⚠️ Ini alat edukasi/skrining, BUKAN diagnosis. Label selalu "berada di rentang X
 *    menurut [guideline]" + anjuran konfirmasi ke tenaga medis. Biomarker TIDAK
 *    masuk Health Score (Risk Panel terpisah).
 */

export type Biomarker = "bp" | "glucose" | "lipid" | "uric_acid";
export type Zone = "green" | "yellow" | "orange" | "red";
export type Sex = "male" | "female";
export type GlucoseContext = "gdp" | "gds" | "pp2" | "hba1c";

/** Satu baris ambang (cermin kolom biomarker_bands). Interval [minValue, maxValue). */
export interface Band {
  biomarker: Biomarker;
  parameter: string;
  sex?: Sex | null;
  bandKey: string;
  label: string;
  zone: Zone;
  /** batas bawah inklusif; null = tak berhingga ke bawah */
  minValue: number | null;
  /** batas atas EKSKLUSIF; null = tak berhingga ke atas */
  maxValue: number | null;
  rank: number;
  unit: string;
  guidelineRef: string;
}

export interface BandRef {
  bandKey: string;
  label: string;
  zone: Zone;
  rank: number;
  unit: string;
}

export type RedFlagReason = "krisis_hipertensi" | "hipoglikemia" | "hiperglikemia_berat";

export interface BiomarkerClassification {
  biomarker: Biomarker;
  /** kategori guideline (untuk BP = komponen dengan rank tertinggi) */
  band: BandRef;
  /** zona tampil efektif: 'red' bila red-flag, selain itu = band.zone */
  zone: Zone;
  redFlag: boolean;
  redFlagReason: RedFlagReason | null;
  guidelineRef: string;
  /** rincian tiap parameter (BP: systolic & diastolic diklasifikasi terpisah) */
  components: Array<{ parameter: string; value: number; band: BandRef }>;
}

export type BiomarkerInput =
  | { biomarker: "bp"; systolic: number; diastolic: number }
  | { biomarker: "glucose"; context: GlucoseContext; value: number }
  // panel lipid: tiap sub-nilai opsional (pemeriksaan bisa parsial)
  | { biomarker: "lipid"; totalChol?: number; ldl?: number; hdl?: number; tg?: number }
  | { biomarker: "uric_acid"; value: number; sex: Sex };

/**
 * Ambang kegawatan akut (mg/dL & mmHg). KONSTANTA keselamatan — jangan pindah
 * ke config. Sumber: addendum §2.2 (TD ≥180/110 = krisis; GDS <70 hipoglikemia,
 * ≥300 krisis hiperglikemia). HbA1c (%) tidak punya red-flag akut.
 */
export const RED_FLAG_THRESHOLDS = {
  bpSystolic: 180,
  bpDiastolic: 110,
  glucoseLow: 70,
  glucoseHigh: 300,
} as const;

const toRef = (b: Band): BandRef => ({
  bandKey: b.bandKey, label: b.label, zone: b.zone, rank: b.rank, unit: b.unit,
});

/**
 * Cari band untuk sebuah nilai pada (biomarker, parameter[, sex]).
 * Mengembalikan null bila tak ada band yang cocok (tabel tak lengkap) — pemanggil
 * harus menangani ini, jangan diam-diam menganggap "normal".
 */
export function classifyValue(
  bands: Band[], biomarker: Biomarker, parameter: string, value: number, sex?: Sex,
): Band | null {
  const candidates = bands.filter(
    (b) => b.biomarker === biomarker && b.parameter === parameter &&
      (b.sex == null || b.sex === sex),
  );
  for (const b of candidates) {
    const okLow = b.minValue == null || value >= b.minValue;
    const okHigh = b.maxValue == null || value < b.maxValue;
    if (okLow && okHigh) return b;
  }
  return null;
}

/** Klasifikasi satu pembacaan biomarker. Melempar Error bila band tak ditemukan. */
export function classifyBiomarker(input: BiomarkerInput, bands: Band[]): BiomarkerClassification {
  switch (input.biomarker) {
    case "bp": return classifyBp(input.systolic, input.diastolic, bands);
    case "glucose": return classifyGlucose(input.context, input.value, bands);
    case "lipid": return classifyLipid(input, bands);
    case "uric_acid": return classifyUricAcid(input.value, input.sex, bands);
  }
}

function classifyBp(systolic: number, diastolic: number, bands: Band[]): BiomarkerClassification {
  const sys = classifyValue(bands, "bp", "systolic", systolic);
  const dia = classifyValue(bands, "bp", "diastolic", diastolic);
  if (!sys || !dia) throw new Error("band tekanan darah tidak lengkap");

  // kategori tertinggi menentukan (addendum §2.2 A)
  const governing = sys.rank >= dia.rank ? sys : dia;
  const redFlag = systolic >= RED_FLAG_THRESHOLDS.bpSystolic || diastolic >= RED_FLAG_THRESHOLDS.bpDiastolic;

  return {
    biomarker: "bp",
    band: toRef(governing),
    zone: redFlag ? "red" : governing.zone,
    redFlag,
    redFlagReason: redFlag ? "krisis_hipertensi" : null,
    guidelineRef: governing.guidelineRef,
    components: [
      { parameter: "systolic", value: systolic, band: toRef(sys) },
      { parameter: "diastolic", value: diastolic, band: toRef(dia) },
    ],
  };
}

function classifyGlucose(context: GlucoseContext, value: number, bands: Band[]): BiomarkerClassification {
  const band = classifyValue(bands, "glucose", context, value);
  if (!band) throw new Error(`band glukosa tidak lengkap untuk konteks ${context}`);

  // red-flag hanya untuk konsentrasi darah (mg/dL); HbA1c (%) tidak akut
  let redFlag = false;
  let reason: RedFlagReason | null = null;
  if (context !== "hba1c") {
    if (value < RED_FLAG_THRESHOLDS.glucoseLow) { redFlag = true; reason = "hipoglikemia"; }
    else if (value >= RED_FLAG_THRESHOLDS.glucoseHigh) { redFlag = true; reason = "hiperglikemia_berat"; }
  }

  return {
    biomarker: "glucose",
    band: toRef(band),
    zone: redFlag ? "red" : band.zone,
    redFlag,
    redFlagReason: reason,
    guidelineRef: band.guidelineRef,
    components: [{ parameter: context, value, band: toRef(band) }],
  };
}

/**
 * Panel lipid: klasifikasi tiap sub-nilai yang ADA; kategori keseluruhan =
 * TERBURUK (rank tertinggi). HDL terbalik sudah dikodekan lewat rank di data
 * (HDL rendah = rank tinggi), jadi "ambil rank tertinggi" berlaku seragam.
 * Tak ada red-flag akut untuk lipid.
 */
function classifyLipid(
  input: { totalChol?: number; ldl?: number; hdl?: number; tg?: number }, bands: Band[],
): BiomarkerClassification {
  const params: Array<[string, number | undefined]> = [
    ["total_chol", input.totalChol], ["ldl", input.ldl], ["hdl", input.hdl], ["tg", input.tg],
  ];
  const components: BiomarkerClassification["components"] = [];
  let governing: Band | null = null;
  for (const [parameter, value] of params) {
    if (value === undefined) continue;
    const b = classifyValue(bands, "lipid", parameter, value);
    if (!b) throw new Error(`band lipid tidak lengkap untuk ${parameter}`);
    components.push({ parameter, value, band: toRef(b) });
    if (!governing || b.rank > governing.rank) governing = b;
  }
  if (!governing) throw new Error("panel lipid tanpa nilai");
  return {
    biomarker: "lipid",
    band: toRef(governing),
    zone: governing.zone,
    redFlag: false,
    redFlagReason: null,
    guidelineRef: governing.guidelineRef,
    components,
  };
}

/** Asam urat: ambang berbeda per jenis kelamin. Tak ada red-flag akut. */
function classifyUricAcid(value: number, sex: Sex, bands: Band[]): BiomarkerClassification {
  const band = classifyValue(bands, "uric_acid", "uric_acid", value, sex);
  if (!band) throw new Error("band asam urat tidak lengkap");
  return {
    biomarker: "uric_acid",
    band: toRef(band),
    zone: band.zone,
    redFlag: false,
    redFlagReason: null,
    guidelineRef: band.guidelineRef,
    components: [{ parameter: "uric_acid", value, band: toRef(band) }],
  };
}

/** Panduan singkat per red-flag (deterministik, tampil bahkan offline). Bukan diagnosis. */
export function redFlagGuidance(reason: RedFlagReason): { title: string; action: string } {
  switch (reason) {
    case "krisis_hipertensi":
      return {
        title: "Tekanan darah sangat tinggi",
        action: "Bila disertai nyeri dada, sesak, sakit kepala hebat, atau pandangan kabur, segera ke IGD / hubungi 119. Jangan tunda.",
      };
    case "hipoglikemia":
      return {
        title: "Gula darah sangat rendah",
        action: "Segera konsumsi 15 gram gula cepat (mis. 3 sdt gula/jus manis), ukur ulang 15 menit lagi. Bila tak sadar/kejang, hubungi 119.",
      };
    case "hiperglikemia_berat":
      return {
        title: "Gula darah sangat tinggi",
        action: "Bila disertai mual, napas cepat, atau lemas berat, segera ke fasilitas kesehatan / hubungi 119.",
      };
  }
}

/**
 * DEFAULT_BIOMARKER_BANDS — cermin seed migration 0010 (v1). Dipakai untuk
 * bootstrap offline & unit test. HARUS sinkron dengan SQL seed; sumber kebenaran
 * produksi tetap tabel biomarker_bands (bisa diperbarui pasca review medis).
 * ⚠️ Ambang menunggu verifikasi dokter sebelum fitur dibuka ke pengguna nyata.
 */
const GUIDELINE_REF: Record<Biomarker, string> = {
  bp: "PERHI/InaSH 2021",
  glucose: "PERKENI 2021",
  lipid: "NCEP ATP III",
  uric_acid: "Nilai rujukan laboratorium",
};

export const DEFAULT_BIOMARKER_BANDS: Band[] = [
  // A) Tekanan darah — PERHI/InaSH
  band("bp", "systolic", "optimal", "Optimal", "green", null, 120, 0, "mmHg"),
  band("bp", "systolic", "normal", "Normal", "green", 120, 130, 1, "mmHg"),
  band("bp", "systolic", "high_normal", "Normal-Tinggi", "yellow", 130, 140, 2, "mmHg"),
  band("bp", "systolic", "ht1", "Hipertensi Derajat 1", "orange", 140, 160, 3, "mmHg"),
  band("bp", "systolic", "ht2", "Hipertensi Derajat 2", "red", 160, 180, 4, "mmHg"),
  band("bp", "systolic", "ht3", "Hipertensi Derajat 3", "red", 180, null, 5, "mmHg"),
  band("bp", "diastolic", "optimal", "Optimal", "green", null, 80, 0, "mmHg"),
  band("bp", "diastolic", "normal", "Normal", "green", 80, 85, 1, "mmHg"),
  band("bp", "diastolic", "high_normal", "Normal-Tinggi", "yellow", 85, 90, 2, "mmHg"),
  band("bp", "diastolic", "ht1", "Hipertensi Derajat 1", "orange", 90, 100, 3, "mmHg"),
  band("bp", "diastolic", "ht2", "Hipertensi Derajat 2", "red", 100, 110, 4, "mmHg"),
  band("bp", "diastolic", "ht3", "Hipertensi Derajat 3", "red", 110, null, 5, "mmHg"),
  // B) Gula darah — PERKENI
  band("glucose", "gdp", "normal", "Normal", "green", null, 100, 0, "mg/dL"),
  band("glucose", "gdp", "predm", "Prediabetes", "yellow", 100, 126, 1, "mg/dL"),
  band("glucose", "gdp", "dm", "Diabetes", "red", 126, null, 2, "mg/dL"),
  band("glucose", "gds", "normal", "Normal", "green", null, 140, 0, "mg/dL"),
  band("glucose", "gds", "predm", "Prediabetes", "yellow", 140, 200, 1, "mg/dL"),
  band("glucose", "gds", "dm", "Diabetes", "red", 200, null, 2, "mg/dL"),
  band("glucose", "pp2", "normal", "Normal", "green", null, 140, 0, "mg/dL"),
  band("glucose", "pp2", "predm", "Prediabetes", "yellow", 140, 200, 1, "mg/dL"),
  band("glucose", "pp2", "dm", "Diabetes", "red", 200, null, 2, "mg/dL"),
  band("glucose", "hba1c", "normal", "Normal", "green", null, 5.7, 0, "%"),
  band("glucose", "hba1c", "predm", "Prediabetes", "yellow", 5.7, 6.5, 1, "%"),
  band("glucose", "hba1c", "dm", "Diabetes", "red", 6.5, null, 2, "%"),
  // C) Lipid — NCEP ATP III (cermin seed migration 0011). Ambang V2 sudah direview dokter.
  band("lipid", "total_chol", "desirable", "Diinginkan", "green", null, 200, 0, "mg/dL"),
  band("lipid", "total_chol", "borderline", "Batas Tinggi", "yellow", 200, 240, 1, "mg/dL"),
  band("lipid", "total_chol", "high", "Tinggi", "red", 240, null, 2, "mg/dL"),
  band("lipid", "ldl", "optimal", "Optimal", "green", null, 100, 0, "mg/dL"),
  band("lipid", "ldl", "near_optimal", "Mendekati Optimal", "green", 100, 130, 1, "mg/dL"),
  band("lipid", "ldl", "borderline", "Batas Tinggi", "yellow", 130, 160, 2, "mg/dL"),
  band("lipid", "ldl", "high", "Tinggi", "orange", 160, 190, 3, "mg/dL"),
  band("lipid", "ldl", "very_high", "Sangat Tinggi", "red", 190, null, 4, "mg/dL"),
  band("lipid", "hdl", "low", "Rendah", "red", null, 40, 2, "mg/dL"),
  band("lipid", "hdl", "borderline", "Batas", "yellow", 40, 60, 1, "mg/dL"),
  band("lipid", "hdl", "optimal", "Baik", "green", 60, null, 0, "mg/dL"),
  band("lipid", "tg", "normal", "Normal", "green", null, 150, 0, "mg/dL"),
  band("lipid", "tg", "borderline", "Batas Tinggi", "yellow", 150, 200, 1, "mg/dL"),
  band("lipid", "tg", "high", "Tinggi", "orange", 200, 500, 2, "mg/dL"),
  band("lipid", "tg", "very_high", "Sangat Tinggi", "red", 500, null, 3, "mg/dL"),
  // D) Asam urat — sadar-gender (cermin seed migration 0011). Ambang V2 sudah direview dokter.
  band("uric_acid", "uric_acid", "normal", "Normal", "green", null, 7.0, 0, "mg/dL", "male"),
  band("uric_acid", "uric_acid", "high", "Tinggi", "red", 7.0, null, 1, "mg/dL", "male"),
  band("uric_acid", "uric_acid", "normal", "Normal", "green", null, 6.0, 0, "mg/dL", "female"),
  band("uric_acid", "uric_acid", "high", "Tinggi", "red", 6.0, null, 1, "mg/dL", "female"),
];

function band(
  biomarker: Biomarker, parameter: string, bandKey: string, label: string,
  zone: Zone, minValue: number | null, maxValue: number | null, rank: number, unit: string,
  sex?: Sex,
): Band {
  return {
    biomarker, parameter, bandKey, label, zone, minValue, maxValue, rank, unit,
    sex: sex ?? null,
    guidelineRef: GUIDELINE_REF[biomarker],
  };
}
