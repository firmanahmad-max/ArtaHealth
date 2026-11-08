import { describe, it, expect } from "vitest";
import { parseWhatsNewSeen, pendingWhatsNew, serializeWhatsNewSeen } from "../whats-new.ts";

const ITEMS = [
  { id: "focus", since: "2026-09" },
  { id: "beranda", since: "2026-09" },
  { id: "pengingat", since: "2026-11" },
  { id: "ramadan-menu", since: "2027-02" },
];

describe("Apa Baru per entri", () => {
  it("nilai versi lama '2026-09' → entri sept dianggap sudah dilihat, entri Nov tetap muncul", () => {
    const seen = parseWhatsNewSeen("2026-09", ITEMS);
    expect([...seen].sort()).toEqual(["beranda", "focus"]);
    expect(pendingWhatsNew(ITEMS, seen, "2026-11-10").map((i) => i.id)).toEqual(["pengingat", "ramadan-menu"]);
  });

  it("menutup lalu menambah entri baru → hanya entri baru yang muncul (yang lama tak berulang)", () => {
    const afterNov = parseWhatsNewSeen(serializeWhatsNewSeen(new Set(["focus", "beranda"]), ["pengingat"]), ITEMS);
    expect(pendingWhatsNew(ITEMS, afterNov, "2027-02-01").map((i) => i.id)).toEqual(["ramadan-menu"]);
  });

  it("pengguna baru tak disuguhi berita kedaluwarsa (> 3 bulan)", () => {
    expect(pendingWhatsNew(ITEMS, new Set(), "2026-11-10").map((i) => i.id))
      .toEqual(["focus", "beranda", "pengingat", "ramadan-menu"]);
    expect(pendingWhatsNew(ITEMS, new Set(), "2026-12-01").map((i) => i.id))
      .toEqual(["pengingat", "ramadan-menu"]);
  });

  it("masukan rusak/kosong → dianggap belum ada yang dilihat; serialisasi unik & terurut", () => {
    expect(parseWhatsNewSeen(null, ITEMS).size).toBe(0);
    expect(parseWhatsNewSeen("{rusak", ITEMS).size).toBe(0);
    expect(parseWhatsNewSeen('[1,"focus"]', ITEMS)).toEqual(new Set(["focus"]));
    expect(serializeWhatsNewSeen(new Set(["b", "a"]), ["a", "c"])).toBe('["a","b","c"]');
  });
});
