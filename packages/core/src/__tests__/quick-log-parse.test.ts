import { describe, it, expect } from "vitest";
import { parseQuickLog } from "../quick-log-parse.ts";

describe("parseQuickLog — hidrasi", () => {
  it("gelas → 250 ml/gelas", () => {
    expect(parseQuickLog("minum 2 gelas")).toMatchObject({ kind: "hydration", volumeMl: 500 });
  });
  it("ml langsung", () => {
    expect(parseQuickLog("minum air 350 ml")).toMatchObject({ kind: "hydration", volumeMl: 350 });
  });
  it("liter & botol", () => {
    expect(parseQuickLog("minum 1 liter")).toMatchObject({ volumeMl: 1000 });
    expect(parseQuickLog("air 1 botol")).toMatchObject({ volumeMl: 600 });
  });
});

describe("parseQuickLog — tidur", () => {
  it("jam → menit", () => {
    expect(parseQuickLog("tidur 7 jam")).toMatchObject({ kind: "sleep", sleepMinutes: 420 });
  });
  it("jam + menit & desimal koma", () => {
    expect(parseQuickLog("tidur 6 jam 30 menit")).toMatchObject({ sleepMinutes: 390 });
    expect(parseQuickLog("tidur 7,5 jam")).toMatchObject({ sleepMinutes: 450 });
  });
});

describe("parseQuickLog — aktivitas", () => {
  it("langkah", () => {
    expect(parseQuickLog("jalan 3000 langkah")).toMatchObject({ kind: "activity", activityType: "walk", steps: 3000 });
  });
  it("langkah dengan pemisah ribuan", () => {
    expect(parseQuickLog("hari ini 5.000 langkah")).toMatchObject({ steps: 5000 });
  });
  it("durasi olahraga + tipe", () => {
    expect(parseQuickLog("lari 20 menit")).toMatchObject({ kind: "activity", activityType: "run", durationMin: 20 });
    expect(parseQuickLog("yoga 30 menit")).toMatchObject({ activityType: "yoga", durationMin: 30 });
  });
});

describe("parseQuickLog — berat", () => {
  it("kg desimal", () => {
    expect(parseQuickLog("berat badan 68,5 kg")).toMatchObject({ kind: "weight", weightKg: 68.5 });
  });
  it("berat tak wajar diabaikan", () => {
    expect(parseQuickLog("berat 500 kg")).toBeNull();
  });
});

describe("parseQuickLog — mood", () => {
  it("angka 1-5", () => {
    expect(parseQuickLog("mood 4")).toMatchObject({ kind: "mood", mood: 4 });
  });
  it("kata perasaan", () => {
    expect(parseQuickLog("mood senang")).toMatchObject({ mood: 5 });
    expect(parseQuickLog("perasaan sedih hari ini")).toMatchObject({ mood: 2 });
  });
});

describe("parseQuickLog — bukan perintah log → null", () => {
  it("pertanyaan biasa", () => {
    expect(parseQuickLog("kenapa saya susah tidur ya?")).toBeNull();
    expect(parseQuickLog("berapa target minum saya?")).toBeNull();
    expect(parseQuickLog("olahraga apa yang bagus untuk pemula")).toBeNull();
  });
  it("kosong", () => {
    expect(parseQuickLog("")).toBeNull();
  });
});
