"use client";
import type { QuickLogIntent } from "@arta/core";
import { logHydration, logSleep, logActivity, logMood, logWeight } from "./quicklog";

/**
 * ArtaBot quick-log — terapkan intent hasil parse ke log yang ada (reuse lib/quicklog,
 * offline-first + sync). Dipanggil dari chat setelah parseQuickLog cocok.
 */
export async function applyQuickLog(intent: QuickLogIntent): Promise<void> {
  switch (intent.kind) {
    case "hydration":
      await logHydration(intent.volumeMl ?? 0);
      break;
    case "sleep": {
      const end = new Date();
      const start = new Date(end.getTime() - (intent.sleepMinutes ?? 0) * 60_000);
      await logSleep(start, end);
      break;
    }
    case "activity":
      await logActivity(intent.activityType ?? "other", intent.durationMin, intent.steps);
      break;
    case "mood":
      await logMood(intent.mood ?? 3);
      break;
    case "weight":
      await logWeight(intent.weightKg ?? 0);
      break;
  }
}
