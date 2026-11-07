import { describe, it, expect } from "vitest";
import { ramadanWrapped } from "../fasting/ramadan-wrapped.ts";
import { wrappedShareCard, hijriYearOf } from "../fasting/wrapped-share.ts";

const START = "2027-02-18";
const w7miss2 = ramadanWrapped({
  entries: [{ date: "2027-02-19", status: "not_fasting" }, { date: "2027-02-22", status: "not_fasting" }],
  startDate: START, endDate: "2027-02-24",
}); // 5/7, streak 2, tier baik

describe("wrappedShareCard", () => {
  it("tahun Hijriah dari awal Ramadan 2027 = 1448 H", () => {
    expect(hijriYearOf(START)).toBe(1448);
    expect(hijriYearOf("bukan-tanggal")).toBeNull();
  });

  it("privasi default: tanpa qadha, tanpa % / total hari", () => {
    const c = wrappedShareCard(w7miss2, { startDate: START, inProgress: false })!;
    expect(c.title).toBe("Ramadan 1448 H");
    expect(c.heroValue).toBe("5");
    const all = JSON.stringify(c);
    expect(all).not.toMatch(/qadha/i);
    expect(all).not.toContain("%");
    expect(all).not.toContain("7 hari");
    expect(c.stats).toEqual([{ value: "2 hari", label: "rentetan terpanjang" }]);
  });

  it("showCompletion menambah % + total hanya atas pilihan pengguna", () => {
    const c = wrappedShareCard(w7miss2, { startDate: START, inProgress: false, showCompletion: true })!;
    expect(c.stats).toContainEqual({ value: "71%", label: "dari 7 hari" });
  });

  it("headline publik selalu positif (tier mulai tak bernada 'kurang')", () => {
    const low = ramadanWrapped({
      entries: ["2027-02-18", "2027-02-19", "2027-02-20"].map((date) => ({ date, status: "not_fasting" as const })),
      startDate: START, endDate: "2027-02-21",
    }); // 1/4 → mulai
    const c = wrappedShareCard(low, { startDate: START, inProgress: false })!;
    expect(c.headline).toContain("Setiap hari puasa berarti");
    expect(c.headline).not.toMatch(/berikutnya|lebih lapang/);
    expect(c.stats).toEqual([]); // rentetan 1 tak ditampilkan
  });

  it("sedang berjalan → label 'sejauh ini' + headline istiqamah bila belum terputus", () => {
    const full = ramadanWrapped({ entries: [], startDate: START, endDate: "2027-02-27" });
    const c = wrappedShareCard(full, { startDate: START, inProgress: true })!;
    expect(c.subtitle).toBe("Rekap puasaku sejauh ini");
    expect(c.headline).toContain("istiqamah");
    expect(c.caption).toContain("10 hari berpuasa sejauh ini");
  });

  it("tanpa hari berpuasa → null (tak ada yang dibagikan)", () => {
    const none = ramadanWrapped({ entries: [{ date: START, status: "not_fasting" }], startDate: START, endDate: START });
    expect(wrappedShareCard(none, { startDate: START, inProgress: false })).toBeNull();
    expect(wrappedShareCard(ramadanWrapped({ entries: [], startDate: "", endDate: "" }), { startDate: START, inProgress: false })).toBeNull();
  });
});
