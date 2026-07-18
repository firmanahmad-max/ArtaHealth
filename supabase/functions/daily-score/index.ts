// ArtaHealth · Edge Function `daily-score`
// Menulis read-model daily_scores memakai engine deterministik yang SAMA dengan
// Dashboard (packages/core) — CONTEXT §3: satu sumber kebenaran, LLM tidak terlibat.
//
// Dipicu pg_cron tiap jam menit :59 (migration 0005). Fungsi memfilter profil yang
// jam LOKAL-nya 23 (profiles.timezone) → efeknya skor final ditulis 23:59 waktu user.
// Panggil manual dengan ?force=1 untuk menghitung semua profil hari ini (backfill/uji).
//
// Deploy: supabase functions deploy daily-score
// (import relatif ke packages/core ikut ter-bundle oleh CLI)

import { createClient } from "npm:@supabase/supabase-js@2";
import { aggregateDayInputs } from "../../../packages/core/src/aggregate.ts";
import { computeHealthScore } from "../../../packages/core/src/scoring/health-score.ts";
import { localDateKey, localHour, utcRangeForLocalDate } from "../../../packages/core/src/timezone.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // bypass RLS — hanya di Edge Function (CONTEXT §3)
  );
  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = new Date();

  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, timezone, target_hydration_ml, target_steps")
    .is("deleted_at", null)
    .not("onboarded_at", "is", null);
  if (profilesErr) return json({ error: profilesErr.message }, 500);

  let processed = 0;
  const failures: string[] = [];

  for (const profile of profiles ?? []) {
    try {
      let tz = profile.timezone || "Asia/Jakarta";
      let hour: number;
      try {
        hour = localHour(now, tz);
      } catch {
        tz = "Asia/Jakarta"; // timezone tidak dikenal → fallback aman
        hour = localHour(now, tz);
      }
      if (!force && hour !== 23) continue;

      const dateKey = localDateKey(now, tz);
      const { startUtc, endUtc } = utcRangeForLocalDate(dateKey, tz);
      const startIso = startUtc.toISOString();
      const endIso = endUtc.toISOString();

      const inRange = (table: string, col: string, cols: string) =>
        supabase.from(table).select(cols).eq("profile_id", profile.id)
          .is("deleted_at", null).gte(col, startIso).lt(col, endIso);

      // ISO weekday tanggal lokal (1=Sen..7=Min) — kalender, bebas zona
      const jsDay = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      const isoWeekday = jsDay === 0 ? 7 : jsDay;

      const [hydration, sleep, activity, mood, habits, completions] = await Promise.all([
        inRange("hydration_logs", "logged_at", "volume_ml"),
        inRange("sleep_logs", "sleep_end", "sleep_start, sleep_end"),
        inRange("activity_logs", "logged_at", "duration_min, steps"),
        inRange("mood_logs", "logged_at", "mood, logged_at"),
        supabase.from("habits").select("id, schedule").eq("profile_id", profile.id)
          .eq("is_active", true).is("deleted_at", null),
        supabase.from("habit_completions").select("habit_id").eq("profile_id", profile.id).eq("date", dateKey),
      ]);
      const queryErr = [hydration, sleep, activity, mood, habits, completions].find((r) => r.error);
      if (queryErr?.error) throw new Error(queryErr.error.message);

      // tanpa Database types ter-generate, select dinamis tidak ter-infer — cast eksplisit per tabel
      const rows = <T,>(res: { data: unknown }): T[] => (res.data ?? []) as T[];
      const habitRows = rows<{ id: string; schedule: { days?: unknown } | null }>(habits);

      const scheduledHabits = habitRows.filter((h) => {
        const days = h.schedule?.days;
        return Array.isArray(days) ? days.includes(isoWeekday) : true;
      });
      const completedIds = new Set(rows<{ habit_id: string }>(completions).map((c) => c.habit_id));
      const completedCount = scheduledHabits.filter((h) => completedIds.has(h.id)).length;

      const inputs = aggregateDayInputs(
        {
          hydration: rows<{ volume_ml: number }>(hydration).map((r) => ({ volumeMl: r.volume_ml })),
          sleep: rows<{ sleep_start: string; sleep_end: string }>(sleep)
            .map((r) => ({ sleepStart: r.sleep_start, sleepEnd: r.sleep_end })),
          activity: rows<{ duration_min: number | null; steps: number | null }>(activity)
            .map((r) => ({ durationMin: r.duration_min, steps: r.steps })),
          mood: rows<{ mood: number; logged_at: string }>(mood)
            .map((r) => ({ mood: r.mood, loggedAt: r.logged_at })),
          habits: scheduledHabits.length > 0
            ? { completed: completedCount, total: scheduledHabits.length }
            : undefined,
        },
        { hydrationMl: profile.target_hydration_ml ?? 2500, steps: profile.target_steps ?? 8000 },
      );
      const { score, breakdown } = computeHealthScore(inputs);

      const { error: upsertErr } = await supabase.from("daily_scores").upsert(
        {
          profile_id: profile.id,
          date: dateKey,
          health_score: score,
          breakdown,
          computed_at: now.toISOString(),
        },
        { onConflict: "profile_id,date" },
      );
      if (upsertErr) throw new Error(upsertErr.message);
      processed++;
    } catch (e) {
      // satu profil gagal tidak boleh menggagalkan yang lain; id saja, tanpa data kesehatan
      failures.push(profile.id);
      console.error(`daily-score gagal untuk profil ${profile.id}: ${(e as Error).message}`);
    }
  }

  return json({ processed, skipped: (profiles?.length ?? 0) - processed - failures.length, failed: failures.length });
});
