import { describe, it, expect } from "vitest";
import {
  normalizeMuted, mutedKinds, isKindMuted, toggleMuted, NOTIFICATION_CATEGORIES,
} from "../notification-prefs.ts";
import { buildReminder } from "../notifications.ts";
import { insightContextSchema } from "../ai/contracts.ts";

describe("preferensi jenis pengingat", () => {
  it("normalizeMuted: buang nilai asing/duplikat, urut baku; masukan rusak → kosong", () => {
    expect(normalizeMuted(["weekly", "xxx", "hydration", "weekly", 3])).toEqual(["hydration", "weekly"]);
    expect(normalizeMuted(null)).toEqual([]);
    expect(normalizeMuted("weekly")).toEqual([]);
  });

  it("kategori → kind push; Ramadan mencakup sahur & berbuka", () => {
    expect(mutedKinds(["ramadan"])).toEqual(["sahur", "iftar"]);
    expect(isKindMuted("iftar", ["ramadan"])).toBe(true);
    expect(isKindMuted("weekly", ["ramadan"])).toBe(false);
    expect(mutedKinds([])).toEqual([]);
  });

  it("toggleMuted menambah/menghapus tanpa merusak urutan", () => {
    const a = toggleMuted([], "weekly", true);
    const b = toggleMuted(a, "hydration", true);
    expect(b).toEqual(["hydration", "weekly"]);
    expect(toggleMuted(b, "weekly", false)).toEqual(["hydration"]);
  });

  it("setiap kind reminder_log tercakup tepat satu kategori", () => {
    const kinds = NOTIFICATION_CATEGORIES.flatMap((c) => c.kinds);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect([...kinds].sort()).toEqual(["habit", "hydration", "iftar", "sahur", "sleep", "weekly"]);
  });

  it("buildReminder: kategori dibisukan dilewati, mesin beralih ke yang masih relevan", () => {
    const ctx = insightContextSchema.parse({
      date: "2026-07-22", score: { today: 60 },
      habits: { completed: 0, total: 2 }, sleep: { durationMin: 360 },
    });
    expect(buildReminder(ctx, { hour: 20 })!.kind).toBe("habit");
    expect(buildReminder(ctx, { hour: 20, mutedKinds: mutedKinds(["habit"]) })!.kind).toBe("sleep");
    expect(buildReminder(ctx, { hour: 20, mutedKinds: mutedKinds(["habit", "sleep"]) })).toBeNull();
  });
});
