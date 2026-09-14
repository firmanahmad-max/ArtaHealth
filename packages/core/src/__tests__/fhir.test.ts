import { describe, it, expect } from "vitest";
import {
  toPatient, biomarkerToObservations, medicationToStatement, buildFhirBundle, summarizeBundle,
  type FhirBundle,
} from "../fhir.ts";

describe("toPatient", () => {
  it("petakan nama/sex/tgl lahir; hilangkan yang kosong", () => {
    expect(toPatient({ name: "Budi", sex: "male", birthDate: "1990-05-01" })).toEqual({
      resourceType: "Patient", name: [{ text: "Budi" }], gender: "male", birthDate: "1990-05-01",
    });
    expect(toPatient({ name: "  ", sex: null, birthDate: null })).toEqual({ resourceType: "Patient" });
  });
});

describe("biomarkerToObservations", () => {
  it("tekanan darah → satu Observation vital-signs dgn dua komponen (mm[Hg])", () => {
    const [o] = biomarkerToObservations({ biomarker: "bp", values: { systolic: 151, diastolic: 93 }, measuredAt: "2026-09-01T08:00:00Z" });
    expect(o!.resourceType).toBe("Observation");
    expect((o!.code as { coding: { code: string }[] }).coding[0]!.code).toBe("85354-9");
    const comp = o!.component as Array<{ code: { coding: { code: string }[] }; valueQuantity: { value: number; code: string } }>;
    expect(comp.map((c) => c.code.coding[0]!.code)).toEqual(["8480-6", "8462-4"]);
    expect(comp[0]!.valueQuantity).toMatchObject({ value: 151, code: "mm[Hg]" });
  });
  it("glukosa hba1c → LOINC 4548-4 satuan %", () => {
    const [o] = biomarkerToObservations({ biomarker: "glucose", context: "hba1c", values: { value: 6.4 }, measuredAt: "2026-09-01T08:00:00Z" });
    expect((o!.code as { coding: { code: string }[] }).coding[0]!.code).toBe("4548-4");
    expect(o!.valueQuantity).toMatchObject({ value: 6.4, unit: "%", code: "%" });
  });
  it("lipid → satu Observation per sub-nilai yang ADA", () => {
    const out = biomarkerToObservations({ biomarker: "lipid", values: { totalChol: 210, hdl: 45 }, measuredAt: "2026-09-01T08:00:00Z" });
    expect(out).toHaveLength(2);
    expect(out.map((o) => (o.code as { coding: { code: string }[] }).coding[0]!.code).sort()).toEqual(["2085-9", "2093-3"]);
  });
  it("asam urat → LOINC 3084-1", () => {
    const [o] = biomarkerToObservations({ biomarker: "uric_acid", values: { value: 7.2 }, measuredAt: "2026-09-01T08:00:00Z" });
    expect((o!.code as { coding: { code: string }[] }).coding[0]!.code).toBe("3084-1");
  });
  it("nilai non-finite / konteks glukosa tak dikenal → []", () => {
    expect(biomarkerToObservations({ biomarker: "bp", values: { systolic: NaN, diastolic: 90 }, measuredAt: "x" })).toEqual([]);
    expect(biomarkerToObservations({ biomarker: "glucose", context: "zzz", values: { value: 100 }, measuredAt: "x" })).toEqual([]);
  });
});

describe("medicationToStatement", () => {
  it("obat aktif dgn dosis → MedicationStatement active + dosage.text", () => {
    expect(medicationToStatement({ name: "Amlodipin", dosage: "5 mg", isActive: true, since: "2026-08-01T00:00:00Z" })).toEqual({
      resourceType: "MedicationStatement", status: "active",
      medicationCodeableConcept: { text: "Amlodipin" },
      dosage: [{ text: "5 mg" }], effectiveDateTime: "2026-08-01T00:00:00Z",
    });
  });
  it("nonaktif → stopped; nama kosong → null", () => {
    expect(medicationToStatement({ name: "X", isActive: false })!.status).toBe("stopped");
    expect(medicationToStatement({ name: "  ", isActive: true })).toBeNull();
  });
});

describe("buildFhirBundle", () => {
  it("Patient dulu → Observation urut waktu → MedicationStatement; timestamp dipakai", () => {
    const bundle = buildFhirBundle({
      patient: { name: "Ani", sex: "female", birthDate: "1965-01-01" },
      biomarkers: [
        { biomarker: "glucose", context: "gdp", values: { value: 126 }, measuredAt: "2026-09-02T08:00:00Z" },
        { biomarker: "bp", values: { systolic: 150, diastolic: 90 }, measuredAt: "2026-09-01T08:00:00Z" },
      ],
      medications: [{ name: "Metformin", dosage: "500 mg", isActive: true }],
      timestamp: "2026-09-14T00:00:00Z",
    });
    expect(bundle.type).toBe("collection");
    expect(bundle.timestamp).toBe("2026-09-14T00:00:00Z");
    const types = bundle.entry.map((e) => e.resource.resourceType);
    expect(types).toEqual(["Patient", "Observation", "Observation", "MedicationStatement"]);
    // BP (1 Sep) sebelum glukosa (2 Sep) karena urut waktu
    expect((bundle.entry[1]!.resource.code as { text: string }).text).toBe("Tekanan darah");
  });
  it("input kosong → Bundle valid tanpa entri", () => {
    const b = buildFhirBundle({});
    expect(b.entry).toEqual([]);
    expect(b.resourceType).toBe("Bundle");
  });
});

describe("summarizeBundle", () => {
  it("hitung resource per jenis", () => {
    const bundle: FhirBundle = buildFhirBundle({
      patient: { name: "A" },
      biomarkers: [{ biomarker: "lipid", values: { totalChol: 200, ldl: 130 }, measuredAt: "2026-09-01T08:00:00Z" }],
    });
    expect(summarizeBundle(bundle)).toEqual({ Patient: 1, Observation: 2 });
  });
});
