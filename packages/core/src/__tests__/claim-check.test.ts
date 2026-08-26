import { describe, it, expect } from "vitest";
import {
  claimAssessmentSchema, fallbackAssessment, STANCE_LABEL, STANCE_TONE, CLAIM_STANCES, CURATED_SOURCES,
  detectClaimQuestion,
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

describe("detectClaimQuestion (CK-3)", () => {
  it("mendeteksi pertanyaan verifikasi klaim", () => {
    expect(detectClaimQuestion("Benarkah madu bisa menyembuhkan batuk?")).toBe(true);
    expect(detectClaimQuestion("ini hoaks atau bukan ya")).toBe(true);
    expect(detectClaimQuestion("vaksin bikin autis, mitos atau fakta?")).toBe(true);
    expect(detectClaimQuestion("apakah benar puasa menurunkan gula darah")).toBe(true);
  });
  it("tidak memicu untuk pertanyaan biasa", () => {
    expect(detectClaimQuestion("Berapa target minum saya hari ini?")).toBe(false);
    expect(detectClaimQuestion("olahraga ringan untuk pemula")).toBe(false);
  });
  it("kata kunci tak salah-picu di dalam kata lain", () => {
    expect(detectClaimQuestion("saya sedang benar-benar lelah")).toBe(false); // "benar" bukan cue tunggal
  });
});
