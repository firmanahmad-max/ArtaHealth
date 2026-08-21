/**
 * Medical Vault OCR — kontrak ekstraksi nilai lab (Fase 6 #1) + resolusi ke biomarker.
 * Vision membaca ANGKA hasil lab → JSON; klasifikasi tetap DETERMINISTIK via engine
 * biomarker Fase 2 (classifyBiomarker). AI tidak menilai — hanya OCR. Pola sama
 * Sadar Gizi/Food Diary. Nilai OCR di-validasi (rentang wajar) sebelum dikonfirmasi user.
 */

import { z } from "zod";
import { stripNulls, looseNumber } from "./nutrition-extract.ts";
import type { Biomarker, BiomarkerInput, GlucoseContext, Sex } from "./biomarker.ts";

const loose = (schema: z.ZodTypeAny) => z.preprocess(looseNumber, schema);
const val = loose(z.number().positive().optional());

const extractedLabObject = z.object({
  test_date: z.string().optional(),                              // "YYYY-MM-DD" bila terbaca
  glucose: z.object({ gdp: val, gds: val, pp2: val, hba1c: val }).optional(),  // mg/dL; hba1c %
  lipid: z.object({ total_chol: val, ldl: val, hdl: val, tg: val }).optional(), // mg/dL
  uric_acid: val,                                                 // mg/dL
  bp: z.object({ systolic: val, diastolic: val }).optional(),     // mmHg (jarang di lab)
  confidence: z.record(z.string(), z.unknown()).optional(),
});
export const extractedLabSchema = z.preprocess(stripNulls, extractedLabObject);
export type ExtractedLab = z.infer<typeof extractedLabSchema>;

/** Satu temuan lab siap diklasifikasi + dikonfirmasi user. */
export interface LabFinding {
  biomarker: Biomarker;
  input: BiomarkerInput;
  /** label Bahasa Indonesia utk UI konfirmasi */
  label: string;
  /** ringkasan nilai utk ditampilkan */
  summary: string;
}

const GLU_LABEL: Record<GlucoseContext, string> = {
  gdp: "Glukosa Puasa (GDP)", gds: "Glukosa Sewaktu (GDS)",
  pp2: "Glukosa 2 Jam PP", hba1c: "HbA1c",
};

/**
 * Petakan nilai lab teridentifikasi → daftar `LabFinding` (BiomarkerInput siap
 * classifyBiomarker). Tiap konteks glukosa = temuan terpisah; lipid = satu panel.
 * Asam urat butuh jenis kelamin (dari profil) — `opts.sex`, default 'male'.
 */
export function resolveLabValues(x: ExtractedLab, opts?: { sex?: Sex }): LabFinding[] {
  const out: LabFinding[] = [];
  const g = x.glucose;
  if (g) {
    for (const ctx of ["gdp", "gds", "pp2", "hba1c"] as GlucoseContext[]) {
      const v = g[ctx];
      if (typeof v === "number") {
        out.push({
          biomarker: "glucose", input: { biomarker: "glucose", context: ctx, value: v },
          label: GLU_LABEL[ctx], summary: `${v}${ctx === "hba1c" ? " %" : " mg/dL"}`,
        });
      }
    }
  }
  const l = x.lipid;
  if (l && (l.total_chol ?? l.ldl ?? l.hdl ?? l.tg) != null) {
    out.push({
      biomarker: "lipid",
      input: { biomarker: "lipid", totalChol: l.total_chol, ldl: l.ldl, hdl: l.hdl, tg: l.tg },
      label: "Profil Lipid",
      summary: [
        l.total_chol != null && `Total ${l.total_chol}`, l.ldl != null && `LDL ${l.ldl}`,
        l.hdl != null && `HDL ${l.hdl}`, l.tg != null && `TG ${l.tg}`,
      ].filter(Boolean).join(" · "),
    });
  }
  if (typeof x.uric_acid === "number") {
    out.push({
      biomarker: "uric_acid", input: { biomarker: "uric_acid", value: x.uric_acid, sex: opts?.sex ?? "male" },
      label: "Asam Urat", summary: `${x.uric_acid} mg/dL`,
    });
  }
  if (x.bp && typeof x.bp.systolic === "number" && typeof x.bp.diastolic === "number") {
    out.push({
      biomarker: "bp", input: { biomarker: "bp", systolic: x.bp.systolic, diastolic: x.bp.diastolic },
      label: "Tekanan Darah", summary: `${x.bp.systolic}/${x.bp.diastolic} mmHg`,
    });
  }
  return out;
}

/** Rentang wajar (deteksi salah-baca OCR). [min, max] inklusif. */
const PLAUSIBLE: Record<string, [number, number]> = {
  gdp: [30, 800], gds: [30, 800], pp2: [30, 800], hba1c: [3, 20],
  total_chol: [50, 600], ldl: [10, 500], hdl: [5, 200], tg: [10, 2000],
  uric_acid: [0.5, 25], systolic: [60, 270], diastolic: [30, 180],
};

export interface LabSanityIssue { field: string; message: string }

/** Tandai nilai di luar rentang wajar → kemungkinan salah baca; user konfirmasi. */
export function labSanity(x: ExtractedLab): LabSanityIssue[] {
  const issues: LabSanityIssue[] = [];
  const check = (field: string, v: number | undefined) => {
    if (v === undefined) return;
    const r = PLAUSIBLE[field];
    if (r && (v < r[0] || v > r[1])) {
      issues.push({ field, message: `Nilai ${field} (${v}) di luar rentang wajar — periksa hasil pindai.` });
    }
  };
  if (x.glucose) { check("gdp", x.glucose.gdp); check("gds", x.glucose.gds); check("pp2", x.glucose.pp2); check("hba1c", x.glucose.hba1c); }
  if (x.lipid) { check("total_chol", x.lipid.total_chol); check("ldl", x.lipid.ldl); check("hdl", x.lipid.hdl); check("tg", x.lipid.tg); }
  check("uric_acid", x.uric_acid);
  if (x.bp) { check("systolic", x.bp.systolic); check("diastolic", x.bp.diastolic); }
  return issues;
}
