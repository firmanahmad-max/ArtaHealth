import { describe, it, expect } from "vitest";
import { classifyUsAqi, aqiNeedsAttention } from "../air-quality.ts";

describe("classifyUsAqi — breakpoints EPA", () => {
  const cases: [number, string][] = [
    [0, "good"], [50, "good"], [51, "moderate"], [100, "moderate"],
    [101, "sensitive"], [150, "sensitive"], [151, "unhealthy"], [200, "unhealthy"],
    [201, "very_unhealthy"], [300, "very_unhealthy"], [301, "hazardous"], [500, "hazardous"],
  ];
  for (const [aqi, cat] of cases) {
    it(`AQI ${aqi} → ${cat}`, () => {
      expect(classifyUsAqi(aqi).category).toBe(cat);
    });
  }
  it("membulatkan & clamp negatif", () => {
    expect(classifyUsAqi(-5).category).toBe("good");
    expect(classifyUsAqi(50.4).category).toBe("good");
    expect(classifyUsAqi(50.6).category).toBe("moderate");
  });
  it("menyertakan label, saran, rentang", () => {
    const r = classifyUsAqi(175);
    expect(r.label).toBe("Tidak sehat");
    expect(r.range).toBe("151–200");
    expect(r.advice.length).toBeGreaterThan(0);
    expect(r.tone).toBe("bad");
  });
});

describe("aqiNeedsAttention", () => {
  it("baik/sedang → tidak; sisanya → ya", () => {
    expect(aqiNeedsAttention("good")).toBe(false);
    expect(aqiNeedsAttention("moderate")).toBe(false);
    expect(aqiNeedsAttention("sensitive")).toBe(true);
    expect(aqiNeedsAttention("hazardous")).toBe(true);
  });
});
