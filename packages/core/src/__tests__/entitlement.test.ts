import { describe, it, expect } from "vitest";
import {
  entitlementOf, canUse, chatQuotaFor, daysLeft, FREE_ENTITLEMENT, CHAT_QUOTA_PER_DAY,
} from "../entitlement.ts";
import { FREE_CHAT_QUOTA_PER_DAY } from "../ai/contracts.ts";

const NOW = Date.parse("2027-02-20T00:00:00Z");

describe("entitlement", () => {
  it("tanpa baris / free / tier tak dikenal → free", () => {
    expect(entitlementOf(null, NOW)).toEqual(FREE_ENTITLEMENT);
    expect(entitlementOf({ tier: "free", valid_until: null }, NOW)).toEqual(FREE_ENTITLEMENT);
    expect(entitlementOf({ tier: "gold", valid_until: null }, NOW)).toEqual(FREE_ENTITLEMENT);
  });

  it("ramadan aktif → fitur Paket; kedaluwarsa / tanggal rusak → free", () => {
    const e = entitlementOf({ tier: "ramadan", valid_until: "2027-03-25T00:00:00Z" }, NOW);
    expect(e.tier).toBe("ramadan");
    expect(e.features).toEqual(["wrapped_share", "fasting_report", "ramadan_menu", "chat_quota_plus"]);
    expect(entitlementOf({ tier: "ramadan", valid_until: "2027-02-19T00:00:00Z" }, NOW)).toEqual(FREE_ENTITLEMENT);
    expect(entitlementOf({ tier: "ramadan", valid_until: "2027-02-20T00:00:00Z" }, NOW)).toEqual(FREE_ENTITLEMENT); // tepat habis
    expect(entitlementOf({ tier: "pro", valid_until: "bukan-tanggal" }, NOW)).toEqual(FREE_ENTITLEMENT);
  });

  it("pro tanpa valid_until = aktif tanpa batas & mencakup Paket Ramadan", () => {
    const e = entitlementOf({ tier: "pro", valid_until: null }, NOW);
    expect(e.tier).toBe("pro");
    expect(e.features).toContain("ramadan_menu");
    expect(daysLeft(e, NOW)).toBeNull();
  });

  it("paywall MATI → semua boleh (perilaku hari ini); NYALA → sesuai tier", () => {
    expect(canUse("fasting_report", FREE_ENTITLEMENT, false)).toBe(true);
    expect(canUse("fasting_report", FREE_ENTITLEMENT, true)).toBe(false);
    const r = entitlementOf({ tier: "ramadan", valid_until: "2027-03-25T00:00:00Z" }, NOW);
    expect(canUse("fasting_report", r, true)).toBe(true);
  });

  it("kuota chat: free = konstanta lama (5), ramadan 20, pro tanpa batas", () => {
    expect(CHAT_QUOTA_PER_DAY.free).toBe(FREE_CHAT_QUOTA_PER_DAY);
    expect(chatQuotaFor(FREE_ENTITLEMENT)).toBe(5);
    expect(chatQuotaFor(entitlementOf({ tier: "ramadan", valid_until: "2027-03-25T00:00:00Z" }, NOW))).toBe(20);
    expect(chatQuotaFor(entitlementOf({ tier: "pro", valid_until: null }, NOW))).toBeNull();
  });

  it("sisa hari dibulatkan ke atas", () => {
    const e = entitlementOf({ tier: "ramadan", valid_until: "2027-02-21T12:00:00Z" }, NOW);
    expect(daysLeft(e, NOW)).toBe(2);
    expect(daysLeft(FREE_ENTITLEMENT, NOW)).toBeNull();
  });
});
