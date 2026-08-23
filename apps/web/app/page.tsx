"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { HealthRing, MetricCard, SyncBadge } from "@arta/design-system";
import { computeHealthScore, aggregateDayInputs } from "@arta/core";
import { db, startOfTodayIso } from "@/lib/db";
import { getSupabase, getPrimaryProfile } from "@/lib/supabase";
import { cacheProfile, pullAll, startSyncLoop } from "@/lib/sync";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { AppNav } from "@/components/AppNav";
import { HabitCard } from "@/components/HabitCard";
import { InsightCard } from "@/components/InsightCard";
import { PushToggle } from "@/components/PushToggle";
import { RiskPanelCard } from "@/components/RiskPanelCard";
import { RamadanHeader } from "@/components/RamadanHeader";
import { FastingToggle } from "@/components/FastingToggle";
import { ImsakiyahCard } from "@/components/ImsakiyahCard";
import { HydrationSessionTracker } from "@/components/HydrationSessionTracker";
import { PreRamadanMedicalCard } from "@/components/PreRamadanMedicalCard";
import { RamadanSetupCard } from "@/components/RamadanSetupCard";
import { SunnahScheduleCard } from "@/components/SunnahScheduleCard";
import { MedicationCard } from "@/components/MedicationCard";
import { NutritionScanCard } from "@/components/NutritionScanCard";
import { AllergyCard } from "@/components/AllergyCard";
import { EaterCard } from "@/components/EaterCard";
import { FoodDiaryCard } from "@/components/FoodDiaryCard";
import { MenuPlannerCard } from "@/components/MenuPlannerCard";
import { VaultCard } from "@/components/VaultCard";
import { FamilyCard } from "@/components/FamilyCard";
import { GamificationCard } from "@/components/GamificationCard";
import { EarlyWarningCard } from "@/components/EarlyWarningCard";
import { featureBiomarker, featureRamadan, featureMedication, featureNutrition, featureFoodDiary, featureVault, featureFamily, featureGamification, featureEarlyWarning } from "@/lib/features";
import { isScheduledOn, isoWeekdayOf } from "@arta/core";
import { todayKey } from "@/lib/habits";
import { isFastingToday } from "@/lib/fasting";
import { useMounted } from "@/lib/useMounted";

const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

/** Dashboard V1 (Sprint 3–4) — semua data dari IndexedDB (offline-first), skor dihitung live. */
export default function Dashboard() {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const syncEnabled = !!getSupabase();
  const mounted = useMounted(); // gate render bergantung-waktu (hindari hydration mismatch)

  // Guard sisi client: tanpa sesi → /login; sesi tanpa onboarding → /onboarding.
  // Saat sesi valid, cache profil+target agar dashboard tetap bekerja offline.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      const profile = await getPrimaryProfile();
      if (!profile?.onboarded_at) { router.replace("/onboarding"); return; }
      await cacheProfile(profile);
      void pullAll(); // perangkat baru / reinstall: tarik riwayat dari server
    });
  }, [router]);

  useEffect(() => startSyncLoop(), []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const today = startOfTodayIso();
  const hydration = useLiveQuery(
    () => db.hydration_logs.where("loggedAt").aboveOrEqual(today).filter((l) => !l.deletedAt).toArray(),
    [today],
  );
  const sleep = useLiveQuery(
    () => db.sleep_logs.where("sleepEnd").aboveOrEqual(today).filter((l) => !l.deletedAt).toArray(),
    [today],
  );
  const activity = useLiveQuery(
    () => db.activity_logs.where("loggedAt").aboveOrEqual(today).filter((l) => !l.deletedAt).toArray(),
    [today],
  );
  const mood = useLiveQuery(
    () => db.mood_logs.where("loggedAt").aboveOrEqual(today).filter((l) => !l.deletedAt).toArray(),
    [today],
  );
  const habits = useLiveQuery(() => db.habits.filter((h) => h.isActive && !h.deletedAt).toArray(), []);
  const habitDone = useLiveQuery(async () => {
    const rows = await db.habit_completions.where("date").equals(todayKey()).toArray();
    return new Set(rows.filter((c) => !c.deletedAt).map((c) => c.habitId));
  }, []);
  const pendingTables = useLiveQuery(async () => {
    const entries = await db.outbox.toArray();
    return new Set(entries.map((e) => e.table));
  }, []);
  const displayName = useLiveQuery(async () => (await db.meta.get("displayName"))?.value, []);
  const targets = useLiveQuery(async () => {
    const [h, s] = await Promise.all([db.meta.get("targetHydrationMl"), db.meta.get("targetSteps")]);
    return { hydrationMl: Number(h?.value) || 2500, steps: Number(s?.value) || 8000 };
  }, []);

  const inputs = aggregateDayInputs(
    {
      hydration: hydration ?? [],
      sleep: sleep ?? [],
      activity: activity ?? [],
      mood: (mood ?? []).map((m) => ({ mood: m.mood, loggedAt: m.loggedAt })),
      habits: (() => {
        const scheduled = (habits ?? []).filter((h) => isScheduledOn(h.schedule, isoWeekdayOf(todayKey())));
        if (scheduled.length === 0) return undefined; // tanpa habit → bobot diredistribusi
        return { completed: scheduled.filter((h) => habitDone?.has(h.id)).length, total: scheduled.length };
      })(),
    },
    targets ?? { hydrationMl: 2500, steps: 8000 },
  );
  // Mode Ramadan: hari puasa → normalisasi khusus (badge 🌙); sesi = jumlah log air
  const fastingToday = useLiveQuery(() => isFastingToday(), []) ?? false;
  const scored = computeHealthScore(
    fastingToday && featureRamadan()
      ? {
          ...inputs, fasting: true,
          hydration: inputs.hydration ? { ...inputs.hydration, sessions: hydration?.length ?? 0 } : undefined,
        }
      : inputs,
  );
  const { score } = scored;
  const fastingContext = scored.breakdown.context === "fasting";

  const hasAny = (hydration?.length ?? 0) + (sleep?.length ?? 0) + (activity?.length ?? 0) + (mood?.length ?? 0) > 0;
  const checklist = [
    { label: "Catat tidur semalam", done: (sleep?.length ?? 0) > 0 },
    { label: "Catat minum pertama", done: (hydration?.length ?? 0) > 0 },
    { label: "Catat mood hari ini", done: (mood?.length ?? 0) > 0 },
  ];
  const allThree = checklist.every((c) => c.done);

  const intakeMl = inputs.hydration?.intakeMl ?? 0;
  const sleepMin = inputs.sleep?.durationMin;
  const exerciseMin = inputs.activity?.exerciseMin;
  const steps = inputs.activity?.steps;
  const latestMood = inputs.mood;
  const pending = (t: string) => (pendingTables?.has(t as never) ?? false) && syncEnabled;

  return (
    <>
      <main style={{ maxWidth: 400, margin: "0 auto", padding: "16px 16px 96px", display: "flex", flexDirection: "column", gap: 12 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>{mounted ? greeting() : " "}</p>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{displayName ? `Hai, ${displayName}` : "Hai"}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {featureRamadan() && <FastingToggle />}
            {syncEnabled && <SyncBadge pending={pendingTables?.size ?? 0} online={online} />}
          </div>
        </header>

        {featureRamadan() && <RamadanHeader />}
        {featureRamadan() && <RamadanSetupCard />}
        {featureRamadan() && <SunnahScheduleCard />}
        {featureRamadan() && <PreRamadanMedicalCard />}
        {featureRamadan() && fastingToday && <ImsakiyahCard />}
        {featureRamadan() && fastingToday && <HydrationSessionTracker />}

        <div style={{ position: "relative", background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-card)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {fastingContext && (
            <span
              title="Skor hari puasa — dikalibrasi khusus"
              style={{ position: "absolute", top: 12, right: 14, fontSize: 18 }}
              aria-label="Skor hari puasa dikalibrasi khusus"
            >
              🌙
            </span>
          )}
          {hasAny ? (
            <HealthRing score={score} />
          ) : (
            <div aria-hidden style={{ width: 168, height: 168, borderRadius: "50%", border: "12px solid var(--ah-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 40, color: "var(--ah-text-tertiary)", fontWeight: 700 }}>—</span>
            </div>
          )}
          {!allThree && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", textAlign: "center" }}>
                Skor pertama Anda muncul setelah 3 pencatatan
              </p>
              {checklist.map((c) => (
                <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.done ? "var(--ah-text-tertiary)" : "var(--ah-text-primary)" }}>
                  <span
                    aria-hidden
                    style={{
                      width: 18, height: 18, borderRadius: "var(--ah-r-full)", fontSize: 11, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: c.done ? "var(--ah-score-excellent)" : "var(--ah-surface-2)",
                      color: c.done ? "#0A0E1A" : "var(--ah-text-tertiary)",
                      border: c.done ? "none" : "1px solid var(--ah-border)",
                    }}
                  >
                    {c.done ? "✓" : ""}
                  </span>
                  <span style={{ textDecoration: c.done ? "line-through" : "none" }}>{c.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <MetricCard
            icon="🌙" name="Tidur"
            value={sleepMin !== undefined ? `${Math.floor(sleepMin / 60)}j ${sleepMin % 60}m` : null}
            pendingSync={pending("sleep_logs")}
            onLog={() => setSheetOpen(true)}
          />
          <MetricCard
            icon="💧" name="Hidrasi"
            value={intakeMl > 0 ? `${(intakeMl / 1000).toFixed(1)} L` : null}
            chip={intakeMl > 0 ? `${Math.round((intakeMl / (targets?.hydrationMl ?? 2500)) * 100)}%` : undefined}
            chipCssVar={intakeMl >= (targets?.hydrationMl ?? 2500) ? "var(--ah-score-excellent)" : "var(--ah-score-fair)"}
            pendingSync={pending("hydration_logs")}
            onLog={() => setSheetOpen(true)}
          />
          <MetricCard
            icon="👟" name="Aktivitas"
            value={exerciseMin !== undefined ? `${exerciseMin} mnt` : steps !== undefined ? `${steps.toLocaleString("id-ID")} lkh` : null}
            pendingSync={pending("activity_logs")}
            onLog={() => setSheetOpen(true)}
          />
          <MetricCard
            icon="🙂" name="Mood"
            value={latestMood !== undefined ? MOOD_EMOJI[latestMood] : null}
            pendingSync={pending("mood_logs")}
            onLog={() => setSheetOpen(true)}
          />
        </div>

        <InsightCard />

        {featureBiomarker() && <RiskPanelCard onLog={() => setSheetOpen(true)} />}

        {featureEarlyWarning() && <EarlyWarningCard />}

        {featureVault() && <VaultCard />}

        {featureMedication() && <MedicationCard />}

        {featureNutrition() && <AllergyCard />}

        {featureNutrition() && <EaterCard />}

        {featureNutrition() && <NutritionScanCard />}

        {featureFoodDiary() && <FoodDiaryCard />}

        {featureFoodDiary() && <MenuPlannerCard />}

        {featureFamily() && <FamilyCard />}

        {featureGamification() && <GamificationCard />}

        <HabitCard />

        <PushToggle />
      </main>

      <QuickLogSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      <AppNav activeKey="home" onLog={() => setSheetOpen(true)} />
    </>
  );
}
