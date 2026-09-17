/**
 * SATUSEHAT / Interoperabilitas FHIR (backlog · SS-1) — pemetaan DETERMINISTIK data ArtaHealth
 * ke resource HL7 FHIR R4 (Patient, Observation, MedicationStatement) + Bundle. MURNI (tanpa
 * I/O) → teruji & dipakai untuk ekspor berkas (SS-1) maupun push SATUSEHAT (SS-2, di balik
 * kredensial organisasi). Kode: LOINC (observasi) + UCUM (satuan). Non-diagnosis: nilai + satuan
 * + waktu apa adanya, tanpa interpretasi klinis. Data kesehatan T1. Lihat docs/addendum-satusehat.md.
 */

const LOINC = "http://loinc.org";
const UCUM = "http://unitsofmeasure.org";
const OBS_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category";

export interface FhirCoding { system: string; code: string; display?: string }
export interface FhirCodeableConcept { coding?: FhirCoding[]; text?: string }
export interface FhirQuantity { value: number; unit: string; system: string; code: string }
export interface FhirResource { resourceType: string; [k: string]: unknown }
export interface FhirBundle {
  resourceType: "Bundle";
  type: "collection";
  timestamp: string;
  entry: Array<{ resource: FhirResource }>;
}

// ---- Patient ----

export interface FhirPatientInput {
  name?: string | null;
  sex?: "male" | "female" | null;
  birthDate?: string | null;  // "YYYY-MM-DD"
}

/** Petakan profil ke FHIR Patient. Field kosong dihilangkan (bukan null). */
export function toPatient(p: FhirPatientInput): FhirResource {
  const r: FhirResource = { resourceType: "Patient" };
  if (p.name && p.name.trim()) r.name = [{ text: p.name.trim() }];
  if (p.sex) r.gender = p.sex;
  if (p.birthDate) r.birthDate = p.birthDate;
  return r;
}

// ---- Observation (biomarker) ----

/** Definisi kode+satuan LOINC/UCUM per parameter biomarker. */
interface Metric { code: string; display: string; unit: string; ucum: string }

const GLUCOSE_METRIC: Record<string, Metric> = {
  gdp: { code: "1558-6", display: "Glukosa puasa", unit: "mg/dL", ucum: "mg/dL" },
  gds: { code: "2339-0", display: "Glukosa sewaktu", unit: "mg/dL", ucum: "mg/dL" },
  pp2: { code: "1521-4", display: "Glukosa 2 jam PP", unit: "mg/dL", ucum: "mg/dL" },
  hba1c: { code: "4548-4", display: "HbA1c", unit: "%", ucum: "%" },
};
const LIPID_METRIC: Record<string, Metric> = {
  totalChol: { code: "2093-3", display: "Kolesterol total", unit: "mg/dL", ucum: "mg/dL" },
  ldl: { code: "2089-1", display: "Kolesterol LDL", unit: "mg/dL", ucum: "mg/dL" },
  hdl: { code: "2085-9", display: "Kolesterol HDL", unit: "mg/dL", ucum: "mg/dL" },
  tg: { code: "2571-8", display: "Trigliserida", unit: "mg/dL", ucum: "mg/dL" },
};
const URIC_METRIC: Metric = { code: "3084-1", display: "Asam urat", unit: "mg/dL", ucum: "mg/dL" };

const qty = (value: number, m: Metric): FhirQuantity =>
  ({ value, unit: m.unit, system: UCUM, code: m.ucum });

type ObsCategory = "vital-signs" | "laboratory" | "activity";
const CATEGORY_DISPLAY: Record<ObsCategory, string> = {
  "vital-signs": "Vital Signs", laboratory: "Laboratory", activity: "Activity",
};
const labCategory = (kind: ObsCategory): FhirCodeableConcept[] =>
  [{ coding: [{ system: OBS_CATEGORY, code: kind, display: CATEGORY_DISPLAY[kind] }] }];

const obs = (
  category: ObsCategory, code: FhirCodeableConcept, effectiveDateTime: string,
  extra: Record<string, unknown>,
): FhirResource => ({
  resourceType: "Observation", status: "final",
  category: labCategory(category), code, effectiveDateTime, ...extra,
});

export interface FhirBiomarkerInput {
  biomarker: "bp" | "glucose" | "lipid" | "uric_acid";
  context?: string | null;               // glukosa: gdp|gds|pp2|hba1c
  values: Record<string, number>;         // bp:{systolic,diastolic} · glucose:{value} · lipid:{...} · uric:{value}
  measuredAt: string;                     // ISO
}

/**
 * Petakan satu pembacaan biomarker → satu/lebih Observation FHIR. Lipid menghasilkan satu
 * Observation per sub-nilai yang ada. Nilai non-finite dilewati. Kembali [] bila tak ada nilai.
 */
export function biomarkerToObservations(b: FhirBiomarkerInput): FhirResource[] {
  const at = b.measuredAt;
  const v = b.values ?? {};
  const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

  if (b.biomarker === "bp") {
    if (!finite(v.systolic) || !finite(v.diastolic)) return [];
    const sys: Metric = { code: "8480-6", display: "Tekanan darah sistolik", unit: "mmHg", ucum: "mm[Hg]" };
    const dia: Metric = { code: "8462-4", display: "Tekanan darah diastolik", unit: "mmHg", ucum: "mm[Hg]" };
    return [obs("vital-signs",
      { coding: [{ system: LOINC, code: "85354-9", display: "Panel tekanan darah" }], text: "Tekanan darah" },
      at, {
        component: [
          { code: { coding: [{ system: LOINC, code: sys.code, display: sys.display }] }, valueQuantity: qty(v.systolic, sys) },
          { code: { coding: [{ system: LOINC, code: dia.code, display: dia.display }] }, valueQuantity: qty(v.diastolic, dia) },
        ],
      })];
  }
  if (b.biomarker === "glucose") {
    const m = GLUCOSE_METRIC[b.context ?? ""];
    if (!m || !finite(v.value)) return [];
    return [obs("laboratory",
      { coding: [{ system: LOINC, code: m.code, display: m.display }], text: m.display },
      at, { valueQuantity: qty(v.value, m) })];
  }
  if (b.biomarker === "uric_acid") {
    if (!finite(v.value)) return [];
    return [obs("laboratory",
      { coding: [{ system: LOINC, code: URIC_METRIC.code, display: URIC_METRIC.display }], text: URIC_METRIC.display },
      at, { valueQuantity: qty(v.value, URIC_METRIC) })];
  }
  // lipid: satu Observation per sub-nilai yang ada
  return Object.entries(LIPID_METRIC).flatMap(([key, m]) =>
    finite(v[key])
      ? [obs("laboratory",
          { coding: [{ system: LOINC, code: m.code, display: m.display }], text: m.display },
          at, { valueQuantity: qty(v[key]!, m) })]
      : []);
}

// ---- Observation (wearable) ----

interface WearableObs { code: string; display: string; category: ObsCategory; unit: string; ucum: string }
/** LOINC/UCUM per metrik wearable harian. Stage tidur (sleep_light/deep/rem) TIDAK dipetakan
 *  (total `sleep` sudah mewakili; hindari dobel di record). */
const WEARABLE_OBS: Record<string, WearableObs> = {
  steps: { code: "41950-7", display: "Jumlah langkah 24 jam", category: "activity", unit: "langkah", ucum: "{steps}" },
  heart_rate: { code: "8867-4", display: "Detak jantung", category: "vital-signs", unit: "denyut/menit", ucum: "/min" },
  sleep: { code: "93832-4", display: "Durasi tidur", category: "activity", unit: "menit", ucum: "min" },
  active_energy: { code: "41981-2", display: "Kalori terbakar", category: "activity", unit: "kkal", ucum: "kcal" },
  weight: { code: "29463-7", display: "Berat badan", category: "vital-signs", unit: "kg", ucum: "kg" },
  spo2: { code: "59408-5", display: "Saturasi oksigen (SpO₂)", category: "vital-signs", unit: "%", ucum: "%" },
};

export interface FhirWearableInput {
  type: string;      // steps|heart_rate|sleep|active_energy|weight|spo2 (stage tidur diabaikan)
  value: number;
  day: string;       // "YYYY-MM-DD" (rollup harian)
  unit?: string;
}

/** Petakan satu rollup wearable harian → Observation FHIR, atau null bila tipe tak didukung/nilai invalid. */
export function wearableToObservation(w: FhirWearableInput): FhirResource | null {
  const m = WEARABLE_OBS[w.type];
  if (!m || typeof w.value !== "number" || !Number.isFinite(w.value)) return null;
  return obs(m.category,
    { coding: [{ system: LOINC, code: m.code, display: m.display }], text: m.display },
    `${w.day}T00:00:00`,
    { valueQuantity: { value: w.value, unit: w.unit || m.unit, system: UCUM, code: m.ucum } });
}

// ---- MedicationStatement ----

export interface FhirMedicationInput {
  name: string;
  dosage?: string | null;
  isActive: boolean;
  since?: string | null;  // ISO (createdAt)
}

/** Petakan obat → MedicationStatement (kode teks; nama bebas). null bila nama kosong. */
export function medicationToStatement(m: FhirMedicationInput): FhirResource | null {
  if (!m.name || !m.name.trim()) return null;
  const r: FhirResource = {
    resourceType: "MedicationStatement",
    status: m.isActive ? "active" : "stopped",
    medicationCodeableConcept: { text: m.name.trim() },
  };
  if (m.dosage && m.dosage.trim()) r.dosage = [{ text: m.dosage.trim() }];
  if (m.since) r.effectiveDateTime = m.since;
  return r;
}

// ---- Bundle ----

export interface FhirBundleInput {
  patient?: FhirPatientInput | null;
  biomarkers?: FhirBiomarkerInput[];
  wearables?: FhirWearableInput[];
  medications?: FhirMedicationInput[];
  timestamp?: string;  // default: now
}

/**
 * Rakit Bundle FHIR (type collection) dari data ArtaHealth. Urutan deterministik: Patient dulu,
 * lalu Observation biomarker (urut waktu), lalu Observation wearable (urut hari lalu tipe), lalu
 * MedicationStatement.
 */
export function buildFhirBundle(input: FhirBundleInput): FhirBundle {
  const entry: Array<{ resource: FhirResource }> = [];
  if (input.patient) entry.push({ resource: toPatient(input.patient) });

  const obsList = (input.biomarkers ?? [])
    .slice()
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .flatMap(biomarkerToObservations);
  for (const resource of obsList) entry.push({ resource });

  const wearList = (input.wearables ?? [])
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day) || a.type.localeCompare(b.type))
    .map(wearableToObservation)
    .filter((r): r is FhirResource => r != null);
  for (const resource of wearList) entry.push({ resource });

  for (const med of input.medications ?? []) {
    const r = medicationToStatement(med);
    if (r) entry.push({ resource: r });
  }

  return {
    resourceType: "Bundle", type: "collection",
    timestamp: input.timestamp ?? new Date().toISOString(),
    entry,
  };
}

/** Ringkas isi Bundle per jenis resource — untuk pratinjau kartu. */
export function summarizeBundle(bundle: FhirBundle): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of bundle.entry) out[e.resource.resourceType] = (out[e.resource.resourceType] ?? 0) + 1;
  return out;
}
