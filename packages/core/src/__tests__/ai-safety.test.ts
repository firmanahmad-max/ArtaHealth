import { describe, it, expect } from "vitest";
import { detectRedFlags, redFlagResponse, isUnsafeOutput, SAFE_OUTPUT_FALLBACK } from "../ai/safety";

describe("red-flag detector (input guard)", () => {
  it("menangkap kedaruratan jantung & napas, termasuk ragam informal", () => {
    expect(detectRedFlags("dada saya nyeri sejak tadi pagi")[0]?.category).toBe("cardiac");
    expect(detectRedFlags("nyeri dada sebelah kiri")[0]?.category).toBe("cardiac");
    expect(detectRedFlags("dada kayak ditimpa batu")[0]?.category).toBe("cardiac");
    expect(detectRedFlags("aku sesak nafas dari semalam")[0]?.category).toBe("breathing");
    expect(detectRedFlags("gak bisa bernapas")[0]?.category).toBe("breathing");
  });

  it("menangkap tanda stroke, pendarahan, kesadaran, dan kehamilan", () => {
    expect(detectRedFlags("mulut saya mencong sebelah")[0]?.category).toBe("stroke");
    expect(detectRedFlags("tangan lemah sebelah kanan")[0]?.category).toBe("stroke");
    expect(detectRedFlags("bicara pelo tiba-tiba")[0]?.category).toBe("stroke");
    expect(detectRedFlags("muntah darah")[0]?.category).toBe("bleeding");
    expect(detectRedFlags("anak saya kejang")[0]?.category).toBe("consciousness");
    expect(detectRedFlags("lagi hamil 7 bulan tapi ada pendarahan")).not.toHaveLength(0);
  });

  it("menangkap ide menyakiti diri dan memberi respons khusus (bukan 119 ambulans saja)", () => {
    const hits = detectRedFlags("kadang saya ingin mengakhiri hidup");
    expect(hits[0]?.category).toBe("self_harm");
    const res = redFlagResponse(hits);
    expect(res).toContain("119 ext. 8");
    expect(res).toContain("tidak sendirian");
  });

  it("respons darurat umum mengarahkan ke 119 dan menghentikan analisis", () => {
    const res = redFlagResponse(detectRedFlags("nyeri dada"));
    expect(res).toContain("119");
    expect(res).toMatch(/berhenti menganalisis/i);
  });

  it("pesan darurat bebas markdown — UI merender teks apa adanya", () => {
    for (const input of ["nyeri dada", "ingin mengakhiri hidup"]) {
      const res = redFlagResponse(detectRedFlags(input));
      expect(res).not.toContain("**");
      expect(res).not.toMatch(/\[.+\]\(.+\)/);
    }
  });

  it("pertanyaan biasa TIDAK memicu red flag (hindari alarm palsu berlebihan)", () => {
    expect(detectRedFlags("bagaimana cara tidur lebih nyenyak?")).toHaveLength(0);
    expect(detectRedFlags("target minum saya berapa ya")).toHaveLength(0);
    expect(detectRedFlags("olahraga apa yang bagus untuk pemula")).toHaveLength(0);
    expect(detectRedFlags("hari ini saya senang sekali")).toHaveLength(0);
  });

  it("audit hanya menyimpan label pola, bukan kalimat pengguna", () => {
    const hits = detectRedFlags("saya 34 tahun tinggal di Samarinda dan dada saya nyeri");
    expect(hits[0]?.pattern).toBe("nyeri dada");
    expect(JSON.stringify(hits)).not.toContain("Samarinda");
  });
});

describe("input guard biomarker (Fase 2)", () => {
  it("angka tensi krisis di chat langsung memicu red-flag", () => {
    const cases = ["tensi 190/120", "TD 180/110 tadi pagi", "tekanan darah 200 per 130", "bp 185/95"];
    for (const t of cases) {
      const hits = detectRedFlags(t);
      expect(hits.find((h) => h.category === "hypertensive_crisis"), `gagal: ${t}`).toBeTruthy();
    }
  });
  it("angka tensi tepat di ambang & tepat di bawah", () => {
    expect(detectRedFlags("tensi 180/100")).toHaveLength(1);   // sys ≥180 → hit
    expect(detectRedFlags("tensi 170/110")).toHaveLength(1);   // dia ≥110 → hit
    expect(detectRedFlags("tensi 179/109")).toHaveLength(0);   // di bawah → aman
  });
  it("gula darah rendah/kritis di chat memicu, HbA1c tidak", () => {
    expect(detectRedFlags("gula darah saya 55 tadi")[0]?.category).toBe("hypoglycemia");
    expect(detectRedFlags("GDS 320 mg/dL")[0]?.category).toBe("hyperglycemic_crisis");
    expect(detectRedFlags("glukosa 45")[0]?.category).toBe("hypoglycemia");
    expect(detectRedFlags("HbA1c saya 8.5 %")).toHaveLength(0); // % → tak akut
  });
  it("angka telanjang tanpa konteks TIDAK dianggap tensi/gula (hindari false-positive)", () => {
    expect(detectRedFlags("saya lari 190 meter tadi")).toHaveLength(0);
    expect(detectRedFlags("berat saya 55 kg")).toHaveLength(0);
    expect(detectRedFlags("umur saya 45 tahun")).toHaveLength(0);
  });
  it("respons hipoglikemia memakai panduan spesifik (bukan 119 saja)", () => {
    const res = redFlagResponse(detectRedFlags("gula darah saya 55"));
    expect(res).toMatch(/15 gram|gula cepat/i);
    expect(res).toMatch(/berhenti menganalisis/i);
  });
  it("respons krisis hipertensi mengarahkan ke 119", () => {
    const res = redFlagResponse(detectRedFlags("tensi 200/130"));
    expect(res).toContain("119");
    expect(res).toMatch(/berhenti menganalisis/i);
  });
});

describe("output guard", () => {
  it("memblokir diagnosis, dosis, dan instruksi obat", () => {
    expect(isUnsafeOutput("Sepertinya Anda menderita diabetes tipe 2.")).toBe(true);
    expect(isUnsafeOutput("Minum paracetamol 500 mg dua kali sehari.")).toBe(true);
    expect(isUnsafeOutput("Dosis yang tepat adalah 10 mg.")).toBe(true);
    expect(isUnsafeOutput("Sebaiknya hentikan obat tekanan darah Anda.")).toBe(true);
    expect(isUnsafeOutput("Anda tidak perlu ke dokter kok.")).toBe(true);
  });

  it("meloloskan jawaban gaya hidup yang aman", () => {
    expect(isUnsafeOutput("Tidur Anda 18 menit lebih lama dari rata-rata minggu ini.")).toBe(false);
    expect(isUnsafeOutput("Coba minum satu gelas air setiap kali selesai makan.")).toBe(false);
    expect(isUnsafeOutput("Untuk keluhan itu, sebaiknya konsultasikan ke dokter ya.")).toBe(false);
  });

  it("fallback aman mengarahkan ke tenaga medis tanpa mendiagnosis", () => {
    expect(SAFE_OUTPUT_FALLBACK).toMatch(/dokter|apoteker/);
    expect(isUnsafeOutput(SAFE_OUTPUT_FALLBACK)).toBe(false);
  });
});
