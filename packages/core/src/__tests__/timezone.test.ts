import { describe, it, expect } from "vitest";
import { localDateKey, localHour, utcRangeForLocalDate, tzOffsetMinutes, localMinuteOfDay } from "../timezone";

describe("timezone helpers", () => {
  it("offset zona Indonesia benar (tanpa DST)", () => {
    const t = new Date("2026-07-18T10:00:00Z");
    expect(tzOffsetMinutes(t, "Asia/Jakarta")).toBe(420);  // WIB +7
    expect(tzOffsetMinutes(t, "Asia/Makassar")).toBe(480); // WITA +8
    expect(tzOffsetMinutes(t, "Asia/Jayapura")).toBe(540); // WIT +9
  });

  it("tanggal lokal menyeberang hari dengan benar", () => {
    // 18:00 UTC = 01:00 WIB hari berikutnya
    expect(localDateKey(new Date("2026-07-18T18:00:00Z"), "Asia/Jakarta")).toBe("2026-07-19");
    expect(localDateKey(new Date("2026-07-18T10:00:00Z"), "Asia/Jakarta")).toBe("2026-07-18");
  });

  it("jam lokal — filter cron 'jam 23' menemukan profil yang tepat", () => {
    // 16:59 UTC = 23:59 WIB
    expect(localHour(new Date("2026-07-18T16:59:00Z"), "Asia/Jakarta")).toBe(23);
    expect(localHour(new Date("2026-07-18T15:59:00Z"), "Asia/Makassar")).toBe(23);
    expect(localHour(new Date("2026-07-18T16:59:00Z"), "Asia/Makassar")).toBe(0);
    expect(localHour(new Date("2026-07-18T17:00:00Z"), "Asia/Jakarta")).toBe(0);
  });

  it("rentang UTC satu hari lokal Jakarta", () => {
    const { startUtc, endUtc } = utcRangeForLocalDate("2026-07-18", "Asia/Jakarta");
    expect(startUtc.toISOString()).toBe("2026-07-17T17:00:00.000Z"); // 00:00 WIB
    expect(endUtc.toISOString()).toBe("2026-07-18T17:00:00.000Z");   // 24:00 WIB
  });

  it("menit lokal sejak tengah malam (untuk jendela sahur)", () => {
    // 21:39 UTC = 04:39 WIB → 279 menit
    expect(localMinuteOfDay(new Date("2026-02-17T21:39:00Z"), "Asia/Jakarta")).toBe(279);
    // 20:39 UTC = 04:39 WITA
    expect(localMinuteOfDay(new Date("2026-02-17T20:39:00Z"), "Asia/Makassar")).toBe(279);
    expect(localMinuteOfDay(new Date("2026-07-18T17:00:00Z"), "Asia/Jakarta")).toBe(0); // 00:00 WIB
  });

  it("zona ber-DST tetap konsisten (offset diambil tengah hari)", () => {
    const summer = utcRangeForLocalDate("2026-07-04", "America/New_York"); // EDT -4
    expect(summer.startUtc.toISOString()).toBe("2026-07-04T04:00:00.000Z");
    const winter = utcRangeForLocalDate("2026-01-15", "America/New_York"); // EST -5
    expect(winter.startUtc.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });
});
