import { describe, it, expect } from "vitest";
import { extractedLabSchema, resolveLabValues, labSanity } from "../vault-extract.ts";
import { classifyBiomarker, DEFAULT_BIOMARKER_BANDS } from "../biomarker.ts";

describe("extractedLabSchema", () => {
  it("menerima hasil lab valid", () => {
    const r = extractedLabSchema.safeParse({
      test_date: "2026-08-01",
      glucose: { gdp: 130, hba1c: 6.5 },
      lipid: { total_chol: 210, ldl: 140, hdl: 45, tg: 180 },
      uric_acid: 7.2,
    });
    expect(r.success).toBe(true);
  });
  it("toleran string / {value} / null (pola vision berantakan)", () => {
    const r = extractedLabSchema.safeParse({
      glucose: { gdp: "130", gds: null, hba1c: { value: 6.5 } },
      uric_acid: null, lipid: null,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.glucose?.gdp).toBe(130);
      expect(r.data.glucose?.hba1c).toBe(6.5);
      expect(r.data.uric_acid).toBeUndefined();
    }
  });
});

describe("resolveLabValues", () => {
  it("tiap konteks glukosa jadi temuan terpisah + lipid satu panel + uric (sex)", () => {
    const x = extractedLabSchema.parse({
      glucose: { gdp: 130, hba1c: 6.5 },
      lipid: { total_chol: 210, ldl: 140 },
      uric_acid: 7.2,
    });
    const f = resolveLabValues(x, { sex: "female" });
    const kinds = f.map((y) => y.biomarker);
    expect(kinds.filter((k) => k === "glucose").length).toBe(2); // gdp + hba1c
    expect(kinds).toContain("lipid");
    expect(kinds).toContain("uric_acid");
    const uric = f.find((y) => y.biomarker === "uric_acid")!;
    expect(uric.input).toMatchObject({ biomarker: "uric_acid", value: 7.2, sex: "female" });
  });
  it("lipid parsial (hanya LDL) tetap satu panel", () => {
    const x = extractedLabSchema.parse({ lipid: { ldl: 160 } });
    const f = resolveLabValues(x);
    expect(f.length).toBe(1);
    expect(f[0]!.input).toMatchObject({ biomarker: "lipid", ldl: 160 });
  });
  it("lab kosong → tak ada temuan", () => {
    expect(resolveLabValues(extractedLabSchema.parse({ test_date: "2026-01-01" }))).toEqual([]);
  });

  it("temuan bisa langsung diklasifikasi engine biomarker Fase 2", () => {
    const x = extractedLabSchema.parse({ glucose: { gdp: 130 }, uric_acid: 8.5 });
    const findings = resolveLabValues(x, { sex: "male" });
    for (const f of findings) {
      const cls = classifyBiomarker(f.input, DEFAULT_BIOMARKER_BANDS);
      expect(cls.biomarker).toBe(f.biomarker);
      expect(typeof cls.zone).toBe("string");
    }
  });
});

describe("labSanity", () => {
  it("nilai di luar rentang wajar → ditandai", () => {
    const x = extractedLabSchema.parse({ glucose: { gdp: 1500 }, uric_acid: 200 });
    const issues = labSanity(x);
    expect(issues.some((i) => i.field === "gdp")).toBe(true);
    expect(issues.some((i) => i.field === "uric_acid")).toBe(true);
  });
  it("nilai wajar → tanpa isu", () => {
    const x = extractedLabSchema.parse({ glucose: { gdp: 110, hba1c: 5.8 }, lipid: { total_chol: 190 } });
    expect(labSanity(x)).toEqual([]);
  });
});
