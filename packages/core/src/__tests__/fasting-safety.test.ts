import { describe, it, expect } from "vitest";
import { fastingRukhsahNote, RUKHSAH_NOTE, PRE_RAMADAN_MEDICAL } from "../fasting/safety";

describe("keamanan medis puasa §3.3 (deterministik; teks pending review §10)", () => {
  it("rukhsah muncul hanya untuk kegawatan glukosa DI HARI PUASA", () => {
    expect(fastingRukhsahNote("hipoglikemia", true)).toBe(RUKHSAH_NOTE);
    expect(fastingRukhsahNote("hiperglikemia_berat", true)).toBe(RUKHSAH_NOTE);
  });
  it("tidak muncul di hari tidak puasa", () => {
    expect(fastingRukhsahNote("hipoglikemia", false)).toBeNull();
  });
  it("tidak muncul untuk kegawatan non-glukosa atau tanpa red-flag", () => {
    expect(fastingRukhsahNote("krisis_hipertensi", true)).toBeNull();
    expect(fastingRukhsahNote(null, true)).toBeNull();
  });
  it("teks rukhsah menyebut rukhsah & tetap mengarahkan ke tenaga medis", () => {
    expect(RUKHSAH_NOTE).toMatch(/rukhsah|keringanan/i);
    expect(RUKHSAH_NOTE).toMatch(/tenaga medis|dokter/i);
  });
  it("interstitial pra-Ramadan mengarahkan ke dokter, bukan menghakimi", () => {
    expect(PRE_RAMADAN_MEDICAL.body).toMatch(/dokter/i);
    expect(PRE_RAMADAN_MEDICAL.body).toMatch(/diskusikan|sebelum Ramadan/i);
  });
});
