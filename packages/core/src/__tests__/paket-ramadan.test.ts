import { describe, it, expect } from "vitest";
import { formatRupiah, paketInterestSummary, PAKET_TIERS } from "../paket-ramadan.ts";

describe("formatRupiah", () => {
  it("pemisah ribuan titik, deterministik", () => {
    expect(formatRupiah(29000)).toBe("Rp29.000");
    expect(formatRupiah(149000)).toBe("Rp149.000");
    expect(formatRupiah(1250000)).toBe("Rp1.250.000");
    expect(formatRupiah(500)).toBe("Rp500");
    expect(formatRupiah(-5)).toBe("Rp0");
  });
});

describe("paketInterestSummary", () => {
  it("lulus bila minat ≥ ambang; hitung tingkat teratas", () => {
    const s = paketInterestSummary({ season: 8, season_syawal: 3, pro_annual: 1, not_now: 20 }, 100);
    expect(s.interested).toBe(12);
    expect(s.responses).toBe(32);
    expect(s.interestRatePct).toBe(12);
    expect(s.passed).toBe(true);
    expect(s.topTier).toBe("season");
  });
  it("gagal bila di bawah ambang", () => {
    const s = paketInterestSummary({ season: 4, not_now: 30 }, 100);
    expect(s.interestRatePct).toBe(4);
    expect(s.passed).toBe(false);
  });
  it("ambang kustom & desimal", () => {
    const s = paketInterestSummary({ pro_annual: 1 }, 30, 3);
    expect(s.interestRatePct).toBe(3.3);
    expect(s.passed).toBe(true);
    expect(s.topTier).toBe("pro_annual");
  });
  it("seri → urutan PAKET_TIERS; tanpa minat → topTier null", () => {
    expect(paketInterestSummary({ season: 2, season_syawal: 2 }, 50).topTier).toBe(PAKET_TIERS[0]!.id);
    expect(paketInterestSummary({ not_now: 5 }, 50).topTier).toBeNull();
  });
  it("tanpa pengguna aktif / nilai invalid → aman, tak lulus", () => {
    const s = paketInterestSummary({ season: 5, season_syawal: Number.NaN }, 0);
    expect(s.interestRatePct).toBe(0);
    expect(s.passed).toBe(false);
    expect(s.tierCounts.season_syawal).toBe(0);
  });
});
