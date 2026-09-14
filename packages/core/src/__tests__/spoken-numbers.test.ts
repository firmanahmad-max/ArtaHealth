import { describe, it, expect } from "vitest";
import { normalizeSpokenNumbers } from "../spoken-numbers.ts";

describe("normalizeSpokenNumbers", () => {
  it("satuan", () => {
    expect(normalizeSpokenNumbers("minum dua gelas")).toBe("minum 2 gelas");
    expect(normalizeSpokenNumbers("tidur tujuh jam")).toBe("tidur 7 jam");
  });
  it("belasan & sepuluh/sebelas", () => {
    expect(normalizeSpokenNumbers("dua belas")).toBe("12");
    expect(normalizeSpokenNumbers("sepuluh menit")).toBe("10 menit");
    expect(normalizeSpokenNumbers("sebelas")).toBe("11");
  });
  it("puluhan", () => {
    expect(normalizeSpokenNumbers("berat tujuh puluh kg")).toBe("berat 70 kg");
    expect(normalizeSpokenNumbers("dua puluh lima")).toBe("25");
  });
  it("ratusan & ribuan", () => {
    expect(normalizeSpokenNumbers("seratus")).toBe("100");
    expect(normalizeSpokenNumbers("jalan tiga ribu langkah")).toBe("jalan 3000 langkah");
    expect(normalizeSpokenNumbers("lima ribu langkah")).toBe("5000 langkah");
    expect(normalizeSpokenNumbers("seribu")).toBe("1000");
  });
  it("kata bukan-angka utuh", () => {
    expect(normalizeSpokenNumbers("kenapa saya lelah")).toBe("kenapa saya lelah");
    expect(normalizeSpokenNumbers("")).toBe("");
  });
  it("angka digit yang sudah ada tak berubah", () => {
    expect(normalizeSpokenNumbers("minum 2 gelas")).toBe("minum 2 gelas");
  });
  it("beberapa rangkaian dalam satu kalimat", () => {
    expect(normalizeSpokenNumbers("tidur tujuh jam lalu jalan lima ribu langkah"))
      .toBe("tidur 7 jam lalu jalan 5000 langkah");
  });
});
