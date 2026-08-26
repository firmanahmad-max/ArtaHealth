import { describe, it, expect } from "vitest";
import {
  claimAssessmentSchema, fallbackAssessment, STANCE_LABEL, STANCE_TONE, CLAIM_STANCES, CURATED_SOURCES,
} from "../claim-check.ts";

describe("claimAssessmentSchema", () => {
  it("menerima output valid", () => {
    const r = claimAssessmentSchema.safeParse({
      stance: "belum-cukup-bukti",
      ringkasan: "Klaim ini belum didukung bukti kuat.",
      sumber: [{ label: "Kemenkes RI", url: "https://kemkes.go.id" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sumber.length).toBe(1);
  });
  it("sumber default kosong bila tak ada", () => {
    const r = claimAssessmentSchema.safeParse({ stance: "perlu-verifikasi", ringkasan: "x" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sumber).toEqual([]);
  });
  it("menolak stance tak dikenal", () => {
    expect(claimAssessmentSchema.safeParse({ stance: "HOAKS", ringkasan: "x" }).success).toBe(false);
  });
  it("menolak ringkasan kosong", () => {
    expect(claimAssessmentSchema.safeParse({ stance: "didukung", ringkasan: "" }).success).toBe(false);
  });
});

describe("label & tone", () => {
  it("setiap stance punya label & tone", () => {
    for (const s of CLAIM_STANCES) {
      expect(STANCE_LABEL[s]).toBeTruthy();
      expect(["good", "warn", "bad", "neutral"]).toContain(STANCE_TONE[s]);
    }
  });
});

describe("fallbackAssessment", () => {
  it("aman: perlu-verifikasi + sumber resmi, tanpa vonis", () => {
    const f = fallbackAssessment();
    expect(f.stance).toBe("perlu-verifikasi");
    expect(f.sumber.length).toBeGreaterThan(0);
    expect(claimAssessmentSchema.safeParse(f).success).toBe(true);
  });
  it("sumber terkurasi resmi tersedia", () => {
    expect(CURATED_SOURCES.some((s) => /kemenkes|kemkes/i.test(s.label))).toBe(true);
    expect(CURATED_SOURCES.some((s) => /who/i.test(s.label))).toBe(true);
    expect(CURATED_SOURCES.some((s) => /bpom/i.test(s.label))).toBe(true);
  });
});
