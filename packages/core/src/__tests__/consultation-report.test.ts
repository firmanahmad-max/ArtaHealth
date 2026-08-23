import { describe, it, expect } from "vitest";
import {
  summarizeSeries, adherencePct, buildConsultationReport,
  CONSULTATION_DISCLAIMER, type ConsultationReportInput,
} from "../consultation-report.ts";

const p = (t: string, value: number) => ({ t, value });

describe("summarizeSeries", () => {
  it("deret kosong → na", () => {
    const s = summarizeSeries([]);
    expect(s.count).toBe(0);
    expect(s.latest).toBeNull();
    expect(s.direction).toBe("na");
  });
  it("min/max/avg/latest (urut waktu)", () => {
    const s = summarizeSeries([p("2026-08-03", 80), p("2026-08-01", 70), p("2026-08-02", 90)]);
    expect(s.count).toBe(3);
    expect(s.min).toBe(70);
    expect(s.max).toBe(90);
    expect(s.avg).toBeCloseTo(80, 5);
    expect(s.latest).toBe(80);          // titik 2026-08-03
    expect(s.latestAtISO).toBe("2026-08-03");
  });
  it("arah naik / turun / datar", () => {
    const naik = summarizeSeries(Array.from({ length: 9 }, (_, i) => p(`2026-08-0${i + 1}`, 70 + i * 3)));
    expect(naik.direction).toBe("rising");
    const turun = summarizeSeries(Array.from({ length: 9 }, (_, i) => p(`2026-08-0${i + 1}`, 100 - i * 3)));
    expect(turun.direction).toBe("falling");
    const datar = summarizeSeries(Array.from({ length: 9 }, (_, i) => p(`2026-08-0${i + 1}`, 80)));
    expect(datar.direction).toBe("flat");
  });
  it("abaikan nilai/tanggal invalid", () => {
    const s = summarizeSeries([p("2026-08-01", 70), { t: "x", value: 999 }, { t: "2026-08-02", value: NaN }]);
    expect(s.count).toBe(1);
    expect(s.latest).toBe(70);
  });
});

describe("adherencePct", () => {
  it("persen dibulatkan, cap 100", () => {
    expect(adherencePct(10, 8)).toBe(80);
    expect(adherencePct(3, 3)).toBe(100);
    expect(adherencePct(3, 5)).toBe(100); // taken > scheduled → 100
  });
  it("tanpa jadwal → null", () => {
    expect(adherencePct(0, 0)).toBeNull();
  });
});

const emptyInput = (): ConsultationReportInput => ({
  patient: { conditions: [] },
  range: { fromISO: "2026-05-25", toISO: "2026-08-23", days: 90 },
  biomarkers: [], warnings: [], medications: [], lifestyle: null, nutrition: null, documents: [],
  generatedAtISO: "2026-08-23T00:00:00.000Z",
});

describe("buildConsultationReport", () => {
  it("kosong → isEmpty true + disclaimer terpasang", () => {
    const r = buildConsultationReport(emptyInput());
    expect(r.isEmpty).toBe(true);
    expect(r.sections).toEqual([]);
    expect(r.disclaimer).toBe(CONSULTATION_DISCLAIMER);
  });

  it("bagian berisi terdeteksi & urut baku", () => {
    const r = buildConsultationReport({
      ...emptyInput(),
      documents: [{ title: "Lab Prodia", dateISO: "2026-08-01", kind: "lab" }],
      biomarkers: [{ key: "bp", label: "Tekanan darah", unit: "mmHg", latestValue: "150/95", latestAtISO: "2026-08-20" }],
      medications: [{ name: "Amlodipin", schedule: "08:00", adherencePct: 80 }],
    });
    expect(r.isEmpty).toBe(false);
    // urutan baku: biomarkers sebelum medications sebelum documents
    expect(r.sections).toEqual(["biomarkers", "medications", "documents"]);
  });

  it("lifestyle & nutrition dianggap kosong bila semua field null", () => {
    const r = buildConsultationReport({
      ...emptyInput(),
      lifestyle: { sleepAvgH: null, hydrationAvgMl: null, activityAvgMin: null },
      nutrition: { sodiumAvgMg: null, sugarAvgG: null },
    });
    expect(r.sections).not.toContain("lifestyle");
    expect(r.sections).not.toContain("nutrition");
    expect(r.isEmpty).toBe(true);
  });

  it("lifestyle berisi bila ada satu field", () => {
    const r = buildConsultationReport({ ...emptyInput(), lifestyle: { sleepAvgH: 6.5 } });
    expect(r.sections).toEqual(["lifestyle"]);
  });
});
