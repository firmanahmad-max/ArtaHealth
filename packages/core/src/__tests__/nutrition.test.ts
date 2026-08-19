import { describe, it, expect } from "vitest";
import {
  classifyNutrient, nutritionVerdict, dailyBudget, primaryNutrientFor,
  DEFAULT_NUTRITION_BANDS as BANDS, GGL_BUDGET,
} from "../nutrition";

describe("classifyNutrient — traffic light per 100 g/ml", () => {
  it("gula minuman lebih ketat dari padatan", () => {
    expect(classifyNutrient("sugar", 4, "beverage", BANDS)!.zone).toBe("yellow"); // 2.5–7.5 → kuning
    expect(classifyNutrient("sugar", 4, "solid", BANDS)!.zone).toBe("green");      // <5 → hijau
  });
  it("batas interval inklusif-bawah, eksklusif-atas", () => {
    expect(classifyNutrient("sugar", 2.5, "beverage", BANDS)!.zone).toBe("yellow");
    expect(classifyNutrient("sugar", 7.5, "beverage", BANDS)!.zone).toBe("red");
    expect(classifyNutrient("sodium", 600, "solid", BANDS)!.zone).toBe("red");
  });
  it("band tak ditemukan → null", () => {
    expect(classifyNutrient("fiber", 3, "solid", BANDS)).toBeNull();
  });
});

describe("anggaran & nutrien utama personalisasi kondisi", () => {
  it("hipertensi memperketat natrium ke 1500 mg", () => {
    expect(dailyBudget([]).sodium).toBe(2000);
    expect(dailyBudget(["hypertension"]).sodium).toBe(1500);
    expect(GGL_BUDGET.sodium).toBe(2000);
  });
  it("nutrien utama per kondisi", () => {
    expect(primaryNutrientFor(["hypertension"])).toBe("sodium");
    expect(primaryNutrientFor(["diabetes"])).toBe("sugar");
    expect(primaryNutrientFor(["dyslipidemia"])).toBe("sat_fat");
    expect(primaryNutrientFor([])).toBeNull();
  });
});

describe("nutritionVerdict — JEBAKAN TAKARAN SAJI (per kemasan)", () => {
  // teh 500ml: label per takaran saji 250ml gula 22g → sekemasan 44g
  const teh = {
    foodForm: "beverage" as const,
    serving: { sugarG: 22, sodiumMg: 45, satFatG: 0, totalFatG: 0 },
    servingSize: 250, servingsPerPack: 2,
  };
  it("dampak anggaran dihitung SEKEMASAN, bukan per saji", () => {
    const v = nutritionVerdict(teh, BANDS);
    // 44 g / 50 g = 88%
    expect(v.budgetImpact.sugar).toBe(88);
  });
  it("gula per 100ml = 8.8 g → merah → verdict 'Sebaiknya batasi'", () => {
    const v = nutritionVerdict(teh, BANDS);
    expect(v.overall).toBe("red");
    expect(v.headline).toBe("Sebaiknya batasi");
    expect(v.reason).toMatch(/88% anggaran/);
    expect(v.perNutrient.find((p) => p.nutrient === "sugar")!.perPackage).toBe(44);
  });
});

describe("nutritionVerdict — verdict & personalisasi", () => {
  it("produk rendah GGL → hijau 'Pilihan baik'", () => {
    const v = nutritionVerdict(
      { foodForm: "solid", serving: { sugarG: 1, sodiumMg: 20, satFatG: 0.2 }, servingSize: 100, servingsPerPack: 1 },
      BANDS,
    );
    expect(v.overall).toBe("green");
    expect(v.headline).toBe("Pilihan baik");
  });
  it("hipertensi: natrium jadi driver, anggaran lebih ketat disebut", () => {
    // sodium 700mg/100g padatan → merah; sekemasan 700mg / 1500 = 47%
    const v = nutritionVerdict(
      { foodForm: "solid", serving: { sodiumMg: 700, sugarG: 0, satFatG: 0 }, servingSize: 100, servingsPerPack: 1 },
      BANDS, { conditions: ["hypertension"] },
    );
    expect(v.primaryNutrient).toBe("sodium");
    expect(v.overall).toBe("red");
    expect(v.budgetImpact.sodium).toBe(47);
    expect(v.reason).toMatch(/pemantauan tensi/);
  });
  it("lemak trans > 0 memaksa merah + flag, walau nutrien lain rendah", () => {
    const v = nutritionVerdict(
      { foodForm: "solid", serving: { sugarG: 1, sodiumMg: 10, satFatG: 0.1, transFatG: 0.5 }, servingSize: 100, servingsPerPack: 1 },
      BANDS,
    );
    expect(v.overall).toBe("red");
    expect(v.flags.some((f) => /lemak trans/i.test(f))).toBe(true);
  });
  it("penanda positif serat & protein tinggi", () => {
    const v = nutritionVerdict(
      { foodForm: "solid", serving: { sugarG: 2, sodiumMg: 20, satFatG: 0.5, fiberG: 8, proteinG: 12 }, servingSize: 100, servingsPerPack: 1 },
      BANDS,
    );
    expect(v.flags.some((f) => /serat/i.test(f))).toBe(true);
    expect(v.flags.some((f) => /protein/i.test(f))).toBe(true);
  });
});
