import { describe, it, expect } from "vitest";
import { detectAllergens, ALLERGEN_DEFS, type SelectedAllergen } from "../allergen.ts";

const std = (...keys: string[]): SelectedAllergen[] => keys.map((key) => ({ key }));

describe("detectAllergens", () => {
  it("menandai susu & kedelai dari daftar bahan riil", () => {
    const ing = "Tepung terigu, gula, susu bubuk, minyak nabati, lesitin kedelai, garam.";
    const m = detectAllergens(ing, std("milk", "soy", "peanut"));
    const keys = m.map((x) => x.key);
    expect(keys).toContain("milk");
    expect(keys).toContain("soy");
    expect(keys).not.toContain("peanut"); // tak ada kacang tanah
  });

  it("juga menandai gandum (terigu) bila dipantau", () => {
    const ing = "Tepung terigu, gula, susu bubuk.";
    const m = detectAllergens(ing, std("wheat"));
    expect(m.map((x) => x.key)).toEqual(["wheat"]);
    expect(m[0]!.matchedTerm).toBe("terigu");
  });

  it("memisahkan kacang tanah (peanut) dari kacang pohon (tree_nut)", () => {
    const ing = "Cokelat, kacang mede, gula.";
    expect(detectAllergens(ing, std("peanut")).length).toBe(0);
    expect(detectAllergens(ing, std("tree_nut")).map((x) => x.key)).toEqual(["tree_nut"]);
  });

  it("mengenali kacang tanah eksplisit", () => {
    const ing = "Selai kacang tanah, gula, minyak sawit.";
    expect(detectAllergens(ing, std("peanut")).map((x) => x.key)).toEqual(["peanut"]);
  });

  it("mencocokkan pada batas kata — 'kacang polong' tidak memicu kacang tanah", () => {
    const ing = "Kacang polong, wortel, jagung.";
    expect(detectAllergens(ing, std("peanut")).length).toBe(0);
  });

  it("mendukung alergen kustom via label", () => {
    const ing = "Perisa, mononatrium glutamat (MSG), pewarna.";
    const sel: SelectedAllergen[] = [{ key: "custom_msg", label: "MSG", custom: true }];
    const m = detectAllergens(ing, sel);
    expect(m.length).toBe(1);
    expect(m[0]!.custom).toBe(true);
    expect(m[0]!.label).toBe("MSG");
  });

  it("alergen kustom dengan sinonim tambahan", () => {
    const ing = "Gula, glutamat, perisa.";
    const sel: SelectedAllergen[] = [{ key: "custom_msg", label: "MSG", terms: ["glutamat", "msg"], custom: true }];
    expect(detectAllergens(ing, sel).length).toBe(1);
  });

  it("mengembalikan satu match per alergen (dedup), terurut sesuai selected", () => {
    const ing = "Susu, keju, whey, kedelai.";
    const m = detectAllergens(ing, std("milk", "soy"));
    expect(m.length).toBe(2);
    expect(m.map((x) => x.key)).toEqual(["milk", "soy"]); // milk sekali walau 3 istilah cocok
  });

  it("teks kosong / tanpa bahan → tidak ada match", () => {
    expect(detectAllergens("", std("milk"))).toEqual([]);
    expect(detectAllergens("   ", std("milk"))).toEqual([]);
  });

  it("case-insensitive", () => {
    const ing = "TEPUNG TERIGU, SUSU BUBUK";
    expect(detectAllergens(ing, std("milk", "wheat")).length).toBe(2);
  });

  it("tanpa alergen dipantau → tidak ada match walau bahan mengandung alergen", () => {
    const ing = "Susu, telur, gandum.";
    expect(detectAllergens(ing, [])).toEqual([]);
  });

  it("setiap def punya minimal satu istilah & key unik", () => {
    const keys = ALLERGEN_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of ALLERGEN_DEFS) expect(d.terms.length).toBeGreaterThan(0);
  });
});
