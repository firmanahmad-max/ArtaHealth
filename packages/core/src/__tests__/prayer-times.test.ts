import { describe, it, expect } from "vitest";
import { computePrayerTimes, formatTime, KEMENAG_PARAMS, type PrayerInput } from "../fasting/prayer-times";

const JAKARTA: PrayerInput = { year: 2027, month: 2, day: 18, coords: { latitude: -6.2088, longitude: 106.8456 }, timezoneOffset: 7 };
const SAMARINDA: PrayerInput = { year: 2027, month: 2, day: 18, coords: { latitude: -0.5017, longitude: 117.1536 }, timezoneOffset: 8 };

describe("prayer-times — struktur & konsistensi", () => {
  it("urutan waktu monoton: imsak < subuh < terbit < dzuhur < asar < maghrib < isya", () => {
    for (const input of [JAKARTA, SAMARINDA]) {
      const t = computePrayerTimes(input);
      const seq = [t.imsak, t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha];
      for (let i = 1; i < seq.length; i++) {
        expect(seq[i]!, `posisi ${i} pada ${JSON.stringify(input.coords)}`).toBeGreaterThan(seq[i - 1]!);
      }
    }
  });

  it("imsak = subuh − 10 menit (default Kemenag)", () => {
    const t = computePrayerTimes(JAKARTA);
    expect(t.fajr - t.imsak).toBe(10);
    expect(KEMENAG_PARAMS.fajrAngle).toBe(20);
    expect(KEMENAG_PARAMS.ishaAngle).toBe(18);
  });

  it("terbit & maghrib simetris terhadap dzuhur (matahari terbit/terbenam simetris di sekitar tengah hari)", () => {
    for (const input of [JAKARTA, SAMARINDA]) {
      const t = computePrayerTimes(input);
      const before = t.dhuhr - t.sunrise;
      const after = t.maghrib - t.dhuhr;
      expect(Math.abs(before - after), "simetri terbit/terbenam").toBeLessThanOrEqual(2);
    }
  });

  it("waktu berada di rentang wajar untuk kota khatulistiwa Indonesia", () => {
    const t = computePrayerTimes(JAKARTA);
    expect(formatTime(t.dhuhr) >= "11:30" && formatTime(t.dhuhr) <= "12:30").toBe(true);
    expect(formatTime(t.maghrib) >= "17:30" && formatTime(t.maghrib) <= "18:45").toBe(true);
    expect(formatTime(t.fajr) >= "04:00" && formatTime(t.fajr) <= "05:15").toBe(true);
    // cetak untuk kalibrasi vs Kemenag (gerbang §10)
    console.log("JAKARTA 2027-02-18", Object.fromEntries(Object.entries(t).map(([k, v]) => [k, formatTime(v)])));
    console.log("SAMARINDA 2027-02-18", Object.fromEntries(Object.entries(computePrayerTimes(SAMARINDA)).map(([k, v]) => [k, formatTime(v)])));
  });

  it("koreksi manual ±menit diterapkan per waktu", () => {
    const base = computePrayerTimes(JAKARTA);
    const corrected = computePrayerTimes({ ...JAKARTA, params: { corrections: { maghrib: 2, imsak: -1 } } });
    expect(corrected.maghrib - base.maghrib).toBe(2);
    expect(corrected.imsak - base.imsak).toBe(-1);
  });

  it("formatTime membungkus & memformat dua digit", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(1439)).toBe("23:59");
    expect(formatTime(1440)).toBe("00:00");
  });
});
