import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes, scheduledOnDay, fastingScheduleConflicts, nextDoseMinutes,
} from "../medication";

describe("parse waktu jadwal obat", () => {
  it("HH:MM → menit; format salah → null", () => {
    expect(parseTimeToMinutes("08:00")).toBe(480);
    expect(parseTimeToMinutes("20:30")).toBe(1230);
    expect(parseTimeToMinutes("0:05")).toBe(5);
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("08:60")).toBeNull();
    expect(parseTimeToMinutes("pagi")).toBeNull();
  });
});

describe("scheduledOnDay", () => {
  it("days kosong/undefined = tiap hari", () => {
    expect(scheduledOnDay(undefined, 3)).toBe(true);
    expect(scheduledOnDay([], 3)).toBe(true);
  });
  it("days spesifik hanya cocok hari itu", () => {
    expect(scheduledOnDay([1, 4], 4)).toBe(true);
    expect(scheduledOnDay([1, 4], 3)).toBe(false);
  });
});

describe("deteksi konflik jadwal obat vs jam puasa §3.3", () => {
  // imsak 04:39 (279), maghrib 18:24 (1104)
  const IMSAK = 279;
  const MAGHRIB = 1104;
  it("dosis di dalam jendela puasa terdeteksi", () => {
    expect(fastingScheduleConflicts(["08:00", "13:00"], IMSAK, MAGHRIB)).toEqual(["08:00", "13:00"]);
  });
  it("dosis sebelum imsak / setelah maghrib TIDAK bentrok", () => {
    expect(fastingScheduleConflicts(["04:00", "19:00", "21:30"], IMSAK, MAGHRIB)).toEqual([]);
  });
  it("batas: tepat imsak bentrok, tepat maghrib tidak", () => {
    expect(fastingScheduleConflicts(["04:39"], IMSAK, MAGHRIB)).toEqual(["04:39"]); // = imsak → dalam puasa
    expect(fastingScheduleConflicts(["18:24"], IMSAK, MAGHRIB)).toEqual([]);        // = maghrib → sudah boleh
  });
  it("campuran + waktu invalid diabaikan", () => {
    expect(fastingScheduleConflicts(["07:00", "xx", "22:00"], IMSAK, MAGHRIB)).toEqual(["07:00"]);
  });
});

describe("dosis berikutnya", () => {
  it("mengambil dosis terdekat pada/ setelah sekarang", () => {
    expect(nextDoseMinutes(["08:00", "13:00", "20:00"], 540)).toBe(780); // 09:00 → 13:00
    expect(nextDoseMinutes(["08:00", "20:00"], 480)).toBe(480);          // tepat 08:00
  });
  it("semua dosis lewat → null", () => {
    expect(nextDoseMinutes(["08:00", "13:00"], 1000)).toBeNull();
  });
});
