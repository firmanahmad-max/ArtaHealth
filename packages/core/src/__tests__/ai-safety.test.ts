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
