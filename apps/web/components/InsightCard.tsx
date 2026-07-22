"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { SkeletonCard } from "@arta/design-system";
import { AI_DISCLAIMER, type DailyInsight } from "@arta/core";
import { db } from "@/lib/db";
import { buildInsightContext, hasEnoughData } from "@/lib/insight";
import { getDailyInsight } from "@/lib/ai";

const FOCUS_LABEL: Record<DailyInsight["focusArea"], { label: string; cssVar: string }> = {
  sleep: { label: "Tidur", cssVar: "var(--ah-sleep)" },
  hydration: { label: "Hidrasi", cssVar: "var(--ah-hydration)" },
  activity: { label: "Aktivitas", cssVar: "var(--ah-activity)" },
  mood: { label: "Mood", cssVar: "var(--ah-mood)" },
  habit: { label: "Kebiasaan", cssVar: "var(--ah-nutrition)" },
};

/** Daily Insight (blueprint §5.2) — selalu terisi: AI, cache, atau fallback deterministik. */
export function InsightCard() {
  const [state, setState] = useState<{ insight: DailyInsight; source: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // dihitung ulang saat log/habit berubah agar insight tidak basi dalam satu hari
  const stamp = useLiveQuery(async () => {
    const [h, s, a, m, c] = await Promise.all([
      db.hydration_logs.count(), db.sleep_logs.count(), db.activity_logs.count(),
      db.mood_logs.count(), db.habit_completions.count(),
    ]);
    return `${h}-${s}-${a}-${m}-${c}`;
  }, []);

  useEffect(() => {
    if (stamp === undefined) return;
    let cancelled = false;
    void (async () => {
      const { context, dateKey } = await buildInsightContext();
      if (!hasEnoughData(context)) {
        if (!cancelled) { setState(null); setLoading(false); }
        return;
      }
      const result = await getDailyInsight(context, dateKey);
      if (!cancelled) { setState({ insight: result.insight, source: result.source }); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [stamp]);

  if (loading) return <SkeletonCard height={132} />;
  if (!state) return null; // hari kosong: checklist onboarding sudah memandu

  const { insight } = state;
  const focus = FOCUS_LABEL[insight.focusArea];

  return (
    <section
      aria-label="Insight harian"
      style={{
        background: "var(--ah-gradient-soft)", border: "1px solid var(--ah-border)",
        borderRadius: "var(--ah-r-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>Insight hari ini</h2>
        <span style={{ fontSize: 11, fontWeight: 700, color: focus.cssVar, border: `1px solid ${focus.cssVar}`, borderRadius: "var(--ah-r-chip)", padding: "2px 8px" }}>
          Fokus: {focus.label}
        </span>
      </div>

      <p style={{ fontSize: 13, color: "var(--ah-text-primary)", lineHeight: 1.5 }}>{insight.summary}</p>

      <ul style={{ display: "flex", flexDirection: "column", gap: 6, listStyle: "none" }}>
        {insight.targets.map((t) => (
          <li key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--ah-text-secondary)" }}>
            <span aria-hidden style={{ color: "var(--ah-cyan)" }}>→</span>
            {t}
          </li>
        ))}
      </ul>

      <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", fontStyle: "italic" }}>{insight.motivation}</p>

      {/* disclaimer permanen di bawah dashboard/insight (CONTEXT §4) */}
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.4 }}>{AI_DISCLAIMER}</p>
    </section>
  );
}
