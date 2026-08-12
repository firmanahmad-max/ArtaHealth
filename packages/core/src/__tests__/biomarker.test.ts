import { describe, it, expect } from "vitest";
import {
  classifyValue, classifyBiomarker, redFlagGuidance,
  DEFAULT_BIOMARKER_BANDS as BANDS, RED_FLAG_THRESHOLDS,
  type Band,
} from "../biomarker";

describe("classifyValue — batas interval [min, max)", () => {
  it("batas bawah inklusif, batas atas eksklusif", () => {
    // sistolik normal = [120, 130)
    expect(classifyValue(BANDS, "bp", "systolic", 119)!.bandKey).toBe("optimal");
    expect(classifyValue(BANDS, "bp", "systolic", 120)!.bandKey).toBe("normal");
    expect(classifyValue(BANDS, "bp", "systolic", 129)!.bandKey).toBe("normal");
    expect(classifyValue(BANDS, "bp", "systolic", 130)!.bandKey).toBe("high_normal");
  });
  it("nilai ekstrem masuk band tak-berhingga", () => {
    expect(classifyValue(BANDS, "bp", "systolic", -5)!.bandKey).toBe("optimal");
    expect(classifyValue(BANDS, "bp", "systolic", 999)!.bandKey).toBe("ht3");
  });
  it("band tak ditemukan → null", () => {
    expect(classifyValue(BANDS, "bp", "tak_ada", 100)).toBeNull();
    expect(classifyValue([], "bp", "systolic", 120)).toBeNull();
  });
  it("filter sex: null berlaku umum, spesifik hanya cocok gender itu", () => {
    const gendered: Band[] = [
      { biomarker: "uric_acid", parameter: "uric_acid", sex: "male", bandKey: "normal", label: "Normal", zone: "green", minValue: null, maxValue: 7, rank: 0, unit: "mg/dL", guidelineRef: "x" },
      { biomarker: "uric_acid", parameter: "uric_acid", sex: "female", bandKey: "normal", label: "Normal", zone: "green", minValue: null, maxValue: 6, rank: 0, unit: "mg/dL", guidelineRef: "x" },
    ];
    expect(classifyValue(gendered, "uric_acid", "uric_acid", 6.5, "male")!.bandKey).toBe("normal");
    expect(classifyValue(gendered, "uric_acid", "uric_acid", 6.5, "female")).toBeNull(); // 6.5 ≥ 6 → keluar band wanita
    expect(classifyValue(gendered, "uric_acid", "uric_acid", 6.5)).toBeNull();           // tanpa sex tak ada band umum
  });
});

describe("tekanan darah — kategori tertinggi menentukan", () => {
  it("kedua komponen sama → kategori itu", () => {
    const r = classifyBiomarker({ biomarker: "bp", systolic: 135, diastolic: 88 }, BANDS);
    expect(r.band.label).toBe("Normal-Tinggi");
    expect(r.zone).toBe("yellow");
    expect(r.redFlag).toBe(false);
    expect(r.components).toHaveLength(2);
  });
  it("sistolik lebih tinggi → sistolik yang dipakai", () => {
    const r = classifyBiomarker({ biomarker: "bp", systolic: 145, diastolic: 85 }, BANDS);
    expect(r.band.bandKey).toBe("ht1");        // sys ht1(3) > dia high_normal(2)
    expect(r.zone).toBe("orange");
  });
  it("diastolik lebih tinggi → diastolik yang dipakai", () => {
    const r = classifyBiomarker({ biomarker: "bp", systolic: 118, diastolic: 82 }, BANDS);
    expect(r.band.bandKey).toBe("normal");     // dia normal(1) > sys optimal(0)
    expect(r.zone).toBe("green");
  });
  it("optimal saat keduanya optimal", () => {
    const r = classifyBiomarker({ biomarker: "bp", systolic: 110, diastolic: 70 }, BANDS);
    expect(r.band.bandKey).toBe("optimal");
  });
});

describe("tekanan darah — red-flag krisis hipertensi", () => {
  it("sistolik ≥180 memicu red-flag", () => {
    const r = classifyBiomarker({ biomarker: "bp", systolic: 185, diastolic: 95 }, BANDS);
    expect(r.redFlag).toBe(true);
    expect(r.redFlagReason).toBe("krisis_hipertensi");
    expect(r.zone).toBe("red");
  });
  it("diastolik ≥110 memicu red-flag walau sistolik lebih rendah kategorinya", () => {
    const r = classifyBiomarker({ biomarker: "bp", systolic: 150, diastolic: 115 }, BANDS);
    expect(r.redFlag).toBe(true);
    expect(r.band.bandKey).toBe("ht3");        // dia ht3(5) > sys ht1(3)
  });
  it("tepat di ambang 180/110 = red-flag; tepat di bawah = tidak", () => {
    expect(classifyBiomarker({ biomarker: "bp", systolic: 180, diastolic: 100 }, BANDS).redFlag).toBe(true);
    expect(classifyBiomarker({ biomarker: "bp", systolic: 170, diastolic: 110 }, BANDS).redFlag).toBe(true);
    expect(classifyBiomarker({ biomarker: "bp", systolic: 179, diastolic: 109 }, BANDS).redFlag).toBe(false);
    expect(RED_FLAG_THRESHOLDS.bpSystolic).toBe(180);
  });
  it("band tekanan darah tak lengkap → melempar", () => {
    expect(() => classifyBiomarker({ biomarker: "bp", systolic: 120, diastolic: 80 }, [])).toThrow();
  });
});

describe("gula darah — ambang per konteks", () => {
  it("GDP (puasa): <100 normal, 100–125 prediabetes, ≥126 diabetes", () => {
    expect(classifyBiomarker({ biomarker: "glucose", context: "gdp", value: 99 }, BANDS).band.bandKey).toBe("normal");
    expect(classifyBiomarker({ biomarker: "glucose", context: "gdp", value: 100 }, BANDS).band.bandKey).toBe("predm");
    expect(classifyBiomarker({ biomarker: "glucose", context: "gdp", value: 126 }, BANDS).band.bandKey).toBe("dm");
  });
  it("GDS & PP2 pakai ambang <140/140–199/≥200", () => {
    expect(classifyBiomarker({ biomarker: "glucose", context: "gds", value: 139 }, BANDS).band.bandKey).toBe("normal");
    expect(classifyBiomarker({ biomarker: "glucose", context: "gds", value: 200 }, BANDS).band.bandKey).toBe("dm");
    expect(classifyBiomarker({ biomarker: "glucose", context: "pp2", value: 150 }, BANDS).band.bandKey).toBe("predm");
  });
  it("HbA1c (%): <5.7 normal, 5.7–6.4 prediabetes, ≥6.5 diabetes", () => {
    expect(classifyBiomarker({ biomarker: "glucose", context: "hba1c", value: 5.6 }, BANDS).band.bandKey).toBe("normal");
    expect(classifyBiomarker({ biomarker: "glucose", context: "hba1c", value: 6.0 }, BANDS).band.bandKey).toBe("predm");
    expect(classifyBiomarker({ biomarker: "glucose", context: "hba1c", value: 6.5 }, BANDS).band.bandKey).toBe("dm");
  });
  it("konteks tak dikenal (band kosong) → melempar", () => {
    expect(() => classifyBiomarker({ biomarker: "glucose", context: "gdp", value: 100 }, [])).toThrow();
  });
});

describe("gula darah — red-flag akut", () => {
  it("hipoglikemia <70: band tetap normal tapi red-flag & zona merah", () => {
    const r = classifyBiomarker({ biomarker: "glucose", context: "gds", value: 65 }, BANDS);
    expect(r.band.bandKey).toBe("normal");
    expect(r.redFlag).toBe(true);
    expect(r.redFlagReason).toBe("hipoglikemia");
    expect(r.zone).toBe("red");
  });
  it("krisis hiperglikemia ≥300", () => {
    const r = classifyBiomarker({ biomarker: "glucose", context: "gds", value: 320 }, BANDS);
    expect(r.redFlag).toBe(true);
    expect(r.redFlagReason).toBe("hiperglikemia_berat");
  });
  it("batas: 70 & 299 tidak red-flag; 300 red-flag", () => {
    expect(classifyBiomarker({ biomarker: "glucose", context: "gds", value: 70 }, BANDS).redFlag).toBe(false);
    expect(classifyBiomarker({ biomarker: "glucose", context: "gds", value: 299 }, BANDS).redFlag).toBe(false);
    expect(classifyBiomarker({ biomarker: "glucose", context: "gds", value: 300 }, BANDS).redFlag).toBe(true);
  });
  it("HbA1c tidak pernah red-flag akut (satuan %)", () => {
    const r = classifyBiomarker({ biomarker: "glucose", context: "hba1c", value: 12 }, BANDS);
    expect(r.redFlag).toBe(false);
    expect(r.redFlagReason).toBeNull();
  });
});

describe("panduan red-flag", () => {
  it("tiap alasan punya judul & aksi", () => {
    for (const reason of ["krisis_hipertensi", "hipoglikemia", "hiperglikemia_berat"] as const) {
      const g = redFlagGuidance(reason);
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.action.length).toBeGreaterThan(0);
    }
    expect(redFlagGuidance("hipoglikemia").action).toMatch(/15 gram|gula/);
    expect(redFlagGuidance("krisis_hipertensi").action).toMatch(/119|IGD/);
  });
});

describe("seed default lengkap (cermin migration 0010)", () => {
  it("tiap (biomarker,parameter) menutup seluruh garis bilangan tanpa celah", () => {
    const groups = new Map<string, Band[]>();
    for (const b of BANDS) {
      const k = `${b.biomarker}:${b.parameter}`;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(b);
    }
    for (const bands of groups.values()) {
      const sorted = [...bands].sort((a, b) => a.rank - b.rank);
      const first = sorted.at(0)!;
      const last = sorted.at(-1)!;
      expect(first.minValue).toBeNull();                           // mulai dari -inf
      expect(last.maxValue).toBeNull();                            // sampai +inf
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.minValue).toBe(sorted[i - 1]!.maxValue); // bersambung tanpa celah/tumpang tindih
      }
    }
  });
});
