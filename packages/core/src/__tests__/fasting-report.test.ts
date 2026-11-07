import { describe, it, expect } from "vitest";
import { ramadanWrapped } from "../fasting/ramadan-wrapped.ts";
import { buildFastingReport, isDuringFastMinute, FASTING_REPORT_DISCLAIMER, type FastingReportInput } from "../fasting/fasting-report.ts";

const S = "2027-02-18", E = "2027-02-24";
const base = (over: Partial<FastingReportInput> = {}): FastingReportInput => ({
  startDate: S, endDate: E,
  wrapped: ramadanWrapped({ entries: [{ date: "2027-02-20", status: "not_fasting" }], startDate: S, endDate: E }),
  conditions: ["Diabetes"],
  glucose: [], bp: [], weights: [], medications: [],
  generatedAtISO: "2027-02-25T00:00:00Z",
  ...over,
});

describe("buildFastingReport", () => {
  it("hari puasa dari wrapped; tanpa data klinis → bagian null, tanpa poin", () => {
    const r = buildFastingReport(base());
    expect(r.days).toEqual({ total: 7, fasted: 6, notFasted: 1 });
    expect(r.glucose).toBeNull();
    expect(r.bp).toBeNull();
    expect(r.weight).toBeNull();
    expect(r.discussionPoints).toEqual([]);
    expect(r.isEmpty).toBe(false);
    expect(r.disclaimer).toBe(FASTING_REPORT_DISCLAIMER);
  });

  it("gula: dipisah jam puasa vs luar; hitung <70 & ≥300 HANYA saat jam puasa", () => {
    const r = buildFastingReport(base({
      glucose: [
        { date: "2027-02-18", value: 65, duringFast: true },
        { date: "2027-02-19", value: 310, duringFast: true },
        { date: "2027-02-19", value: 120, duringFast: true },
        { date: "2027-02-19", value: 60, duringFast: false },   // luar jam puasa → tak dihitung
        { date: "2027-02-10", value: 50, duringFast: true },    // di luar rentang → disaring
      ],
    }));
    expect(r.glucose!.duringFast).toEqual({ count: 3, min: 65, max: 310, avg: 165 });
    expect(r.glucose!.outsideFast).toEqual({ count: 1, min: 60, max: 60, avg: 60 });
    expect(r.glucose!.lowDuringFast).toBe(1);
    expect(r.glucose!.highDuringFast).toBe(1);
    expect(r.discussionPoints).toContain("1 pembacaan gula darah < 70 mg/dL saat jam puasa.");
    expect(r.discussionPoints).toContain("1 pembacaan gula darah ≥ 300 mg/dL saat jam puasa.");
  });

  it("tekanan darah: statistik + hitung krisis ≥180/110 (sistolik ATAU diastolik)", () => {
    const r = buildFastingReport(base({
      bp: [
        { date: "2027-02-18", systolic: 130, diastolic: 85, duringFast: true },
        { date: "2027-02-19", systolic: 150, diastolic: 112, duringFast: false },
        { date: "2027-02-21", systolic: 182, diastolic: 90, duringFast: true },
      ],
    }));
    expect(r.bp!.duringFast).toEqual({ count: 2, avgSys: 156, avgDia: 88, maxSys: 182, maxDia: 90 });
    expect(r.bp!.crisisCount).toBe(2);
    expect(r.discussionPoints).toContain("2 pembacaan tekanan darah ≥ 180/110 mmHg.");
  });

  it("obat: konflik jam puasa + kepatuhan < 80% jadi poin; ≥ 80% tidak", () => {
    const r = buildFastingReport(base({
      medications: [
        { name: "Metformin 500 mg", times: ["04:00", "12:00"], conflictTimes: ["12:00"], adherencePct: 70 },
        { name: "Amlodipin", times: ["20:00"], conflictTimes: [], adherencePct: 95 },
      ],
    }));
    expect(r.discussionPoints).toEqual([
      "Metformin 500 mg terjadwal pada jam puasa (12:00).",
      "Kepatuhan Metformin 500 mg 70% selama periode ini.",
    ]);
  });

  it("berat: awal/akhir menurut waktu; poin hanya bila |Δ| ≥ 2 kg", () => {
    const small = buildFastingReport(base({
      weights: [
        { date: "2027-02-24", atISO: "2027-02-24T01:00:00Z", kg: 69.2 },
        { date: "2027-02-18", atISO: "2027-02-18T01:00:00Z", kg: 70 },
      ],
    }));
    expect(small.weight).toEqual({ startKg: 70, endKg: 69.2, deltaKg: -0.8 });
    expect(small.discussionPoints).toEqual([]);
    const big = buildFastingReport(base({
      weights: [
        { date: "2027-02-18", atISO: "2027-02-18T01:00:00Z", kg: 70 },
        { date: "2027-02-24", atISO: "2027-02-24T01:00:00Z", kg: 67.5 },
      ],
    }));
    expect(big.discussionPoints).toEqual(["Berat badan berubah -2.5 kg selama periode ini."]);
    expect(buildFastingReport(base({ weights: [{ date: S, atISO: `${S}T01:00:00Z`, kg: 70 }] })).weight).toBeNull();
  });

  it("rentang kosong → isEmpty; jam puasa = [imsak, maghrib)", () => {
    const r = buildFastingReport(base({ wrapped: ramadanWrapped({ entries: [], startDate: "", endDate: "" }) }));
    expect(r.isEmpty).toBe(true);
    expect(isDuringFastMinute(269, 269, 1095)).toBe(true);   // tepat imsak
    expect(isDuringFastMinute(1095, 269, 1095)).toBe(false); // tepat maghrib = sudah berbuka
    expect(isDuringFastMinute(200, 269, 1095)).toBe(false);  // sahur
  });
});
