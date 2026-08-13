import { describe, it, expect } from "vitest";
import { ramadanFastingProgress } from "../fasting/streak";

describe("progres puasa Ramadan §7", () => {
  it("default puasa: tanggal tanpa baris tetap dihitung berpuasa", () => {
    const r = ramadanFastingProgress([], "2027-02-18", "2027-02-20"); // 3 hari
    expect(r).toEqual({ fasted: 3, elapsed: 3 });
  });

  it("hari not_fasting eksplisit dikurangi (transparan, bukan pemutus)", () => {
    const entries = [
      { date: "2027-02-18", status: "fasting" as const },
      { date: "2027-02-19", status: "not_fasting" as const }, // uzur
      { date: "2027-02-20", status: "fasting" as const },
    ];
    // 29 hari berlalu, 1 not_fasting → 28/29
    const r = ramadanFastingProgress(entries, "2027-02-18", "2027-03-18");
    expect(r.elapsed).toBe(29);
    expect(r.fasted).toBe(28);
  });

  it("beberapa not_fasting", () => {
    const entries = [
      { date: "2027-02-19", status: "not_fasting" as const },
      { date: "2027-02-22", status: "not_fasting" as const },
    ];
    const r = ramadanFastingProgress(entries, "2027-02-18", "2027-02-24"); // 7 hari, 2 not_fasting
    expect(r).toEqual({ fasted: 5, elapsed: 7 });
  });

  it("today sebelum start → 0/0", () => {
    expect(ramadanFastingProgress([], "2027-02-18", "2027-02-17")).toEqual({ fasted: 0, elapsed: 0 });
  });

  it("hari pertama", () => {
    expect(ramadanFastingProgress([], "2027-02-18", "2027-02-18")).toEqual({ fasted: 1, elapsed: 1 });
  });

  it("menyeberang batas bulan dengan benar", () => {
    const r = ramadanFastingProgress([], "2027-02-26", "2027-03-02"); // 26,27,28,1,2 = 5 hari
    expect(r).toEqual({ fasted: 5, elapsed: 5 });
  });
});
