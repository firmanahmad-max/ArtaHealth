import { describe, it, expect } from "vitest";
import { dailyInsightSchema, chatReplySchema, insightContextSchema } from "../ai/contracts";
import { fallbackDailyInsight, getPrompt, PROMPT_REGISTRY } from "../ai/prompts";
import { isUnsafeOutput } from "../ai/safety";

const ctx = insightContextSchema.parse({
  date: "2026-07-21",
  sleep: { durationMin: 400 },
  hydration: { totalMl: 1800, targetMl: 2500, pct: 72 },
  activity: { steps: 6200, target: 8000 },
  mood: 4,
  habits: { completed: 3, total: 5 },
  score: { today: 82, yesterday: 76, deltaReason: ["sleep_up"] },
});

describe("kontrak output AI", () => {
  it("menolak output model yang tidak sesuai skema", () => {
    expect(dailyInsightSchema.safeParse({ summary: "ok" }).success).toBe(false);
    expect(dailyInsightSchema.safeParse({ ...validInsight(), targets: [] }).success).toBe(false);
    expect(dailyInsightSchema.safeParse({ ...validInsight(), focusArea: "keuangan" }).success).toBe(false);
    expect(chatReplySchema.safeParse({ reply: "" }).success).toBe(false);
  });

  it("menerima output yang benar", () => {
    expect(dailyInsightSchema.safeParse(validInsight()).success).toBe(true);
    expect(chatReplySchema.parse({ reply: "Halo" }).needsDisclaimer).toBe(true); // default aman
  });
});

describe("fallback deterministik", () => {
  it("selalu menghasilkan insight yang lolos skema (UI tidak pernah kosong)", () => {
    expect(dailyInsightSchema.safeParse(fallbackDailyInsight(ctx)).success).toBe(true);
  });

  it("menyebut delta skor yang benar dan tidak pernah tidak aman", () => {
    const out = fallbackDailyInsight(ctx);
    expect(out.summary).toContain("82");
    expect(out.summary).toMatch(/naik 6 poin/);
    expect(isUnsafeOutput(out.summary + out.motivation + out.targets.join(" "))).toBe(false);
  });

  it("memilih focusArea dari parameter terlemah", () => {
    // hidrasi 72%, aktivitas 78%, tidur 83%, habit 60% → habit paling lemah
    expect(fallbackDailyInsight(ctx).focusArea).toBe("habit");
  });

  it("bekerja pada hari tanpa data apa pun", () => {
    const kosong = fallbackDailyInsight(insightContextSchema.parse({ date: "2026-07-21", score: { today: 0 } }));
    expect(dailyInsightSchema.safeParse(kosong).success).toBe(true);
    expect(kosong.targets.length).toBeGreaterThan(0);
  });
});

describe("prompt registry", () => {
  it("setiap use-case punya prompt ber-versi dengan pagar keselamatan", () => {
    for (const useCase of Object.keys(PROMPT_REGISTRY) as (keyof typeof PROMPT_REGISTRY)[]) {
      const p = getPrompt(useCase);
      expect(p.version).toMatch(/@\d+$/);
      expect(p.system).toMatch(/DILARANG mendiagnosis/);
      expect(p.system).toMatch(/dosis obat/);
      expect(p.system).toMatch(/HANYA JSON/);
      expect(p.buildUser({ a: 1 })).toBe('{"a":1}');
    }
  });
});

function validInsight() {
  return {
    summary: "Tidur Anda naik 18 menit dari rata-rata minggu ini.",
    targets: ["Minum 2,5 liter air"],
    motivation: "Ritme Anda sedang membaik.",
    focusArea: "hydration" as const,
  };
}
