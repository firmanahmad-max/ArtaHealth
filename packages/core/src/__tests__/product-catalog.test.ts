import { describe, it, expect } from "vitest";
import {
  normalizeProductKey, consensusNutrition, buildCatalog, searchCatalog,
  type CatalogContribution,
} from "../product-catalog.ts";
import type { NutritionInput } from "../nutrition.ts";

const ni = (sugarG: number, sodiumMg: number, extra?: Partial<NutritionInput>): NutritionInput => ({
  foodForm: "solid", serving: { sugarG, sodiumMg }, servingSize: 30, servingsPerPack: 1, ...extra,
});

const c = (name: string, n: NutritionInput, at = "2026-09-01T00:00:00Z"): CatalogContribution => ({
  displayName: name, foodForm: n.foodForm, nutrition: n, at,
});

describe("normalizeProductKey", () => {
  it("samakan varian ukuran/kapital/tanda baca", () => {
    expect(normalizeProductKey("Indomie Goreng 85g")).toBe("indomie goreng");
    expect(normalizeProductKey("indomie   goreng!")).toBe("indomie goreng");
    expect(normalizeProductKey("Teh Botol 350ml")).toBe("teh botol");
  });
  it("kosong/simbol → string kosong", () => {
    expect(normalizeProductKey("  ")).toBe("");
    expect(normalizeProductKey("—")).toBe("");
  });
});

describe("consensusNutrition", () => {
  it("median tahan outlier (spam tunggal tak menggeser)", () => {
    const out = consensusNutrition([ni(5, 300), ni(6, 320), ni(999, 310)]);
    expect(out.serving.sugarG).toBe(6);       // median 5,6,999
    expect(out.serving.sodiumMg).toBe(310);   // median 300,310,320
  });
  it("field hilang di sebagian kontribusi tak dihitung 0", () => {
    const out = consensusNutrition([ni(5, 300), { foodForm: "solid", serving: { sodiumMg: 400 }, servingSize: 30, servingsPerPack: 1 }]);
    expect(out.serving.sugarG).toBe(5);       // hanya satu nilai ada → median = 5, bukan 2.5
    expect(out.serving.sodiumMg).toBe(350);   // median 300,400
  });
  it("bentuk = mayoritas", () => {
    const bev = ni(1, 1, { foodForm: "beverage" });
    expect(consensusNutrition([bev, bev, ni(1, 1)]).foodForm).toBe("beverage");
  });
});

describe("buildCatalog", () => {
  it("kelompokkan lintas varian nama, konsensus, hitung, nama terbaru", () => {
    const cat = buildCatalog([
      c("Indomie Goreng 85g", ni(2, 900), "2026-09-01T00:00:00Z"),
      c("Indomie Goreng", ni(3, 950), "2026-09-05T00:00:00Z"),
      c("Teh Botol 350ml", ni(20, 30), "2026-09-02T00:00:00Z"),
    ]);
    expect(cat).toHaveLength(2);
    const indomie = cat.find((e) => e.key === "indomie goreng")!;
    expect(indomie.contributions).toBe(2);
    expect(indomie.displayName).toBe("Indomie Goreng");   // kontribusi terbaru (5 Sep)
    expect(indomie.nutrition.serving.sodiumMg).toBe(925); // median 900,950
    // urut kontribusi terbanyak dulu
    expect(cat[0]!.key).toBe("indomie goreng");
  });
});

describe("searchCatalog", () => {
  const cat = buildCatalog([
    c("Indomie Goreng", ni(2, 900)),
    c("Indomilk Cokelat", ni(10, 100, { foodForm: "beverage" })),
    c("Teh Botol", ni(20, 30, { foodForm: "beverage" })),
  ]);
  it("peringkat: awalan sebelum sekadar mengandung", () => {
    const r = searchCatalog(cat, "indo");
    expect(r.map((e) => e.key)).toEqual(["indomie goreng", "indomilk cokelat"]);
  });
  it("tak cocok → kosong; kueri kosong → semua", () => {
    expect(searchCatalog(cat, "zzz")).toEqual([]);
    expect(searchCatalog(cat, "  ")).toHaveLength(3);
  });
});
