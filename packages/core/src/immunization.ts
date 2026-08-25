/**
 * Jadwal Imunisasi Anak (V3-6) — DETERMINISTIK dari tanggal lahir + jadwal IDAI.
 * Menghitung status tiap vaksin (sudah / jatuh tempo / akan datang / terlambat) untuk
 * mengingatkan orang tua. BUKAN nasihat medis — jadwal mengikuti pedoman; keputusan &
 * pemberian oleh tenaga kesehatan.
 *
 * ⚠️ IMMUNIZATION_SCHEDULE = KERANGKA — WAJIB diverifikasi vs jadwal IDAI terbaru
 * (pola nutrition_bands/food-db) sebelum flag dinyalakan. `guideline_ref` disertakan.
 */

export const IMMUNIZATION_GUIDELINE = "Jadwal Imunisasi IDAI (perlu verifikasi versi terbaru)";

export interface Vaccine {
  key: string;
  label: string;
  /** usia dianjurkan dalam BULAN (0 = saat lahir). */
  ageMonths: number;
  /** catatan singkat (mis. dosis ke-berapa). */
  note?: string;
}

/** Kerangka jadwal primer 0–18 bulan (subset) — WAJIB verifikasi IDAI. */
export const IMMUNIZATION_SCHEDULE: Vaccine[] = [
  { key: "hb0", label: "Hepatitis B (HB-0)", ageMonths: 0, note: "segera setelah lahir" },
  { key: "bcg", label: "BCG", ageMonths: 1 },
  { key: "polio0", label: "Polio 0 (OPV)", ageMonths: 1 },
  { key: "dpt1", label: "DPT-HB-Hib 1", ageMonths: 2 },
  { key: "polio1", label: "Polio 1", ageMonths: 2 },
  { key: "pcv1", label: "PCV 1", ageMonths: 2 },
  { key: "rota1", label: "Rotavirus 1", ageMonths: 2 },
  { key: "dpt2", label: "DPT-HB-Hib 2", ageMonths: 3 },
  { key: "polio2", label: "Polio 2", ageMonths: 3 },
  { key: "dpt3", label: "DPT-HB-Hib 3", ageMonths: 4 },
  { key: "polio3", label: "Polio 3", ageMonths: 4 },
  { key: "ipv", label: "Polio suntik (IPV)", ageMonths: 4 },
  { key: "pcv2", label: "PCV 2", ageMonths: 4 },
  { key: "mr1", label: "Campak-Rubela (MR) 1", ageMonths: 9 },
  { key: "pcv3", label: "PCV 3 (booster)", ageMonths: 12 },
  { key: "dpt4", label: "DPT-HB-Hib 4 (booster)", ageMonths: 18 },
  { key: "mr2", label: "Campak-Rubela (MR) 2", ageMonths: 18 },
];

export type ImmunizationStatus = "given" | "overdue" | "due" | "upcoming";

export interface ImmunizationEntry {
  key: string;
  label: string;
  ageMonths: number;
  note?: string;
  dueISO: string;              // tanggal jatuh tempo (dari tanggal lahir)
  status: ImmunizationStatus;
  ageDueLabel: string;         // mis. "2 bulan", "saat lahir"
}

export interface ImmunizationConfig {
  /** hari sebelum jatuh tempo yang sudah dianggap "jatuh tempo" (default 14). */
  dueWindowDays: number;
}
export const DEFAULT_IMMUNIZATION_CONFIG: ImmunizationConfig = { dueWindowDays: 14 };

/** Tambah `months` bulan ke tanggal (mempertahankan tanggal, clamp akhir bulan). */
export function addMonths(dob: Date, months: number): Date {
  const d = new Date(dob.getTime());
  const targetMonth = d.getMonth() + months;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(targetMonth);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

const ageLabel = (m: number): string => (m === 0 ? "saat lahir" : `${m} bulan`);

/**
 * Susun rencana imunisasi dari tanggal lahir + daftar vaksin yang SUDAH diberikan.
 * Deterministik; urut berdasarkan tanggal jatuh tempo.
 */
export function immunizationPlan(
  birthDateISO: string,
  given: string[] = [],
  nowMs: number = Date.now(),
  config: Partial<ImmunizationConfig> = {},
): ImmunizationEntry[] {
  const cfg = { ...DEFAULT_IMMUNIZATION_CONFIG, ...config };
  const dob = new Date(birthDateISO);
  if (Number.isNaN(dob.getTime())) return [];
  const givenSet = new Set(given);
  const windowMs = cfg.dueWindowDays * 86_400_000;

  return IMMUNIZATION_SCHEDULE
    .map((v): ImmunizationEntry => {
      const dueMs = addMonths(dob, v.ageMonths).getTime();
      let status: ImmunizationStatus;
      if (givenSet.has(v.key)) status = "given";
      else if (nowMs >= dueMs) status = "overdue";
      else if (nowMs >= dueMs - windowMs) status = "due";
      else status = "upcoming";
      return {
        key: v.key, label: v.label, ageMonths: v.ageMonths, note: v.note,
        dueISO: new Date(dueMs).toISOString(), status, ageDueLabel: ageLabel(v.ageMonths),
      };
    })
    .sort((a, b) => a.dueISO.localeCompare(b.dueISO));
}

export interface ImmunizationSummary {
  overdue: number;
  due: number;
  upcoming: number;
  given: number;
  total: number;
}

export function summarizePlan(plan: ImmunizationEntry[]): ImmunizationSummary {
  const s: ImmunizationSummary = { overdue: 0, due: 0, upcoming: 0, given: 0, total: plan.length };
  for (const e of plan) s[e.status]++;
  return s;
}
