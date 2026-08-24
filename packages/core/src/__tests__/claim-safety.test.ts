import { describe, it, expect } from "vitest";
import { assessClaimSafety } from "../claim-safety.ts";

describe("assessClaimSafety — domain", () => {
  it("bukan kesehatan → out_of_domain / reject", () => {
    const r = assessClaimSafety("harga bitcoin naik minggu ini");
    expect(r.category).toBe("out_of_domain");
    expect(r.action).toBe("reject_out_of_domain");
    expect(r.message).toBeTruthy();
  });
  it("kosong/terlalu pendek → out_of_domain", () => {
    expect(assessClaimSafety("").category).toBe("out_of_domain");
    expect(assessClaimSafety("ok").category).toBe("out_of_domain");
  });
});

describe("assessClaimSafety — high caution (escalate, TAK ke AI)", () => {
  it("penyembuhan penyakit serius", () => {
    const r = assessClaimSafety("rebusan daun sirsak bisa menyembuhkan kanker");
    expect(r.category).toBe("high_caution");
    expect(r.action).toBe("escalate");
    expect(r.needsEscalation).toBe(true);
    expect(r.redFlags.some((f) => f.kind === "serious_disease_cure")).toBe(true);
  });
  it("menyuruh berhenti/ganti obat", () => {
    const r = assessClaimSafety("penderita hipertensi cukup herbal, boleh berhenti obat");
    expect(r.action).toBe("escalate");
    expect(r.redFlags.some((f) => f.kind === "medication_change")).toBe(true);
  });
  it("anti-vaksin", () => {
    const r = assessClaimSafety("vaksin menyebabkan autisme pada anak");
    expect(r.action).toBe("escalate");
    expect(r.redFlags.some((f) => f.kind === "anti_vaccine")).toBe(true);
  });
  it("klaim obat ajaib / 100% tanpa efek samping", () => {
    const r = assessClaimSafety("suplemen herbal ini dijamin 100% tanpa efek samping");
    expect(r.action).toBe("escalate");
    expect(r.redFlags.some((f) => f.kind === "miracle_cure")).toBe(true);
  });
  it("nasihat dosis", () => {
    const r = assessClaimSafety("minum vitamin C dengan dosis tinggi tiap jam");
    expect(r.action).toBe("escalate");
    expect(r.redFlags.some((f) => f.kind === "dosage")).toBe(true);
  });
});

describe("assessClaimSafety — reviewable (boleh ke AI)", () => {
  it("klaim kesehatan wajar tanpa red-flag", () => {
    const r = assessClaimSafety("apakah minum air putih cukup penting untuk kesehatan ginjal?");
    expect(r.category).toBe("reviewable");
    expect(r.action).toBe("allow_ai");
    expect(r.needsEscalation).toBe(false);
    expect(r.redFlags).toEqual([]);
    expect(r.message).toBeUndefined();
  });
  it("klaim gizi umum", () => {
    const r = assessClaimSafety("makan sayur dan serat baik untuk gizi seimbang");
    expect(r.action).toBe("allow_ai");
  });
});

describe("assessClaimSafety — batas kata", () => {
  it("kata 'obat' di dalam kata lain tak salah-picu medication_change", () => {
    // "obatan" tak sama dengan token "obat"; frasa medication_change butuh frasa utuh
    const r = assessClaimSafety("toko obat terdekat buka jam berapa");
    // domain kesehatan (obat) → reviewable, bukan escalate (tak ada frasa stop/ganti)
    expect(r.category).toBe("reviewable");
  });
});
