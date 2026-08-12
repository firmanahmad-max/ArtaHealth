"use client";
import { useMemo, useState } from "react";
import { useMounted } from "@/lib/useMounted";
import { useLiveQuery } from "dexie-react-hooks";
import { HealthRing, TimelineItem, EmptyState } from "@arta/design-system";
import { computeHealthScore, aggregateDayInputs } from "@arta/core";
import { db, startOfTodayIso } from "@/lib/db";
import { getSupabase } from "@/lib/supabase";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { AppNav } from "@/components/AppNav";
import { FastingToggle } from "@/components/FastingToggle";
import { featureRamadan } from "@/lib/features";

const DAYS_SHOWN = 14; // virtual list + infinite scroll menyusul saat data membesar (spec §2.5)

type ItemType = "hydration" | "sleep" | "activity" | "mood" | "weight";

interface Item {
  at: string; // ISO — untuk sort & grouping
  type: ItemType;
  icon: string;
  domainCssVar: string;
  title: string;
  detail?: string;
  chip?: string;
  clientId: string;
}

const FILTERS: { key: ItemType | "all"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "hydration", label: "Air" },
  { key: "sleep", label: "Tidur" },
  { key: "activity", label: "Aktivitas" },
  { key: "mood", label: "Mood" },
  { key: "weight", label: "Berat" },
];

const BEVERAGE: Record<string, string> = { water: "Air putih", coffee: "Kopi", tea: "Teh", milk: "Susu", juice: "Jus" };
const ACTIVITY: Record<string, string> = { walk: "Jalan", run: "Lari", cycle: "Sepeda", gym: "Gym", stretch: "Peregangan", yoga: "Yoga", other: "Aktivitas lain" };
const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":");

function dayLabel(dateKey: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateKey}T00:00:00`);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}

const dateKeyOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function TimelinePage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<ItemType | "all">("all");
  const syncEnabled = !!getSupabase();
  const mounted = useMounted(); // gate tanggal (hindari hydration mismatch)

  const since = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (DAYS_SHOWN - 1));
    return d.toISOString();
  }, []);

  const hydration = useLiveQuery(() => db.hydration_logs.where("loggedAt").aboveOrEqual(since).filter((l) => !l.deletedAt).toArray(), [since]);
  const sleep = useLiveQuery(() => db.sleep_logs.where("sleepEnd").aboveOrEqual(since).filter((l) => !l.deletedAt).toArray(), [since]);
  const activity = useLiveQuery(() => db.activity_logs.where("loggedAt").aboveOrEqual(since).filter((l) => !l.deletedAt).toArray(), [since]);
  const mood = useLiveQuery(() => db.mood_logs.where("loggedAt").aboveOrEqual(since).filter((l) => !l.deletedAt).toArray(), [since]);
  const weight = useLiveQuery(() => db.weight_logs.where("loggedAt").aboveOrEqual(since).filter((l) => !l.deletedAt).toArray(), [since]);
  const pendingIds = useLiveQuery(async () => new Set((await db.outbox.toArray()).map((e) => e.clientId)), []);
  const targets = useLiveQuery(async () => {
    const [h, s] = await Promise.all([db.meta.get("targetHydrationMl"), db.meta.get("targetSteps")]);
    return { hydrationMl: Number(h?.value) || 2500, steps: Number(s?.value) || 8000 };
  }, []);

  const items: Item[] = useMemo(() => {
    const all: Item[] = [
      ...(hydration ?? []).map((l): Item => ({
        at: l.loggedAt, type: "hydration", icon: "💧", domainCssVar: "var(--ah-hydration)", clientId: l.clientId,
        title: `Minum ${l.volumeMl} ml`, detail: BEVERAGE[l.beverage],
      })),
      ...(sleep ?? []).map((l): Item => {
        const durMin = Math.round((new Date(l.sleepEnd).getTime() - new Date(l.sleepStart).getTime()) / 60000);
        return {
          at: l.sleepEnd, type: "sleep", icon: "🌙", domainCssVar: "var(--ah-sleep)", clientId: l.clientId,
          title: `Tidur ${Math.floor(durMin / 60)}j ${durMin % 60}m`,
          detail: `${timeOf(l.sleepStart)}–${timeOf(l.sleepEnd)}`,
        };
      }),
      ...(activity ?? []).map((l): Item => ({
        at: l.loggedAt, type: "activity", icon: "👟", domainCssVar: "var(--ah-activity)", clientId: l.clientId,
        title: ACTIVITY[l.activityType] ?? "Aktivitas",
        detail: [l.durationMin ? `${l.durationMin} mnt` : null, l.steps ? `${l.steps.toLocaleString("id-ID")} langkah` : null].filter(Boolean).join(" · ") || undefined,
      })),
      ...(mood ?? []).map((l): Item => ({
        at: l.loggedAt, type: "mood", icon: MOOD_EMOJI[l.mood] ?? "🙂", domainCssVar: "var(--ah-mood)", clientId: l.clientId,
        title: `Mood ${l.mood}/5`, detail: l.note,
      })),
      ...(weight ?? []).map((l): Item => ({
        at: l.loggedAt, type: "weight", icon: "⚖️", domainCssVar: "var(--ah-medical)", clientId: l.clientId,
        title: `Berat ${l.weightKg} kg`,
      })),
    ];
    return all
      .filter((i) => filter === "all" || i.type === filter)
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [hydration, sleep, activity, mood, weight, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const key = dateKeyOf(item.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()];
  }, [items]);

  // skor hari ini untuk ring kecil di header
  const today = startOfTodayIso();
  const todayScore = useMemo(() => {
    const inputs = aggregateDayInputs(
      {
        hydration: (hydration ?? []).filter((l) => l.loggedAt >= today),
        sleep: (sleep ?? []).filter((l) => l.sleepEnd >= today),
        activity: (activity ?? []).filter((l) => l.loggedAt >= today),
        mood: (mood ?? []).filter((l) => l.loggedAt >= today).map((m) => ({ mood: m.mood, loggedAt: m.loggedAt })),
      },
      targets ?? { hydrationMl: 2500, steps: 8000 },
    );
    return computeHealthScore(inputs).score;
  }, [hydration, sleep, activity, mood, targets, today]);

  const todayHasItems = groups.some(([key]) => key === dateKeyOf(new Date().toISOString()));

  return (
    <>
      <main style={{ maxWidth: 400, margin: "0 auto", padding: "16px 16px 96px", display: "flex", flexDirection: "column", gap: 12 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Timeline</h1>
            <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>
              {mounted ? new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {featureRamadan() && <FastingToggle />}
            <HealthRing score={todayScore} size={48} strokeWidth={5} showLabel={false} />
          </div>
        </header>

        <div role="tablist" aria-label="Filter jenis catatan" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                style={{
                  minHeight: 44, padding: "0 14px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
                  border: active ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
                  background: active ? "var(--ah-gradient-soft)" : "var(--ah-surface-1)",
                  color: "var(--ah-text-primary)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {!todayHasItems && (
          <EmptyState
            icon="🗒️"
            title="Belum ada catatan hari ini"
            ctaLabel="+ Catat sesuatu"
            onCta={() => setSheetOpen(true)}
          />
        )}

        {groups.map(([dateKey, dayItems]) => (
          <section key={dateKey}>
            <h2
              style={{
                position: "sticky", top: 0, zIndex: 10, padding: "8px 0",
                fontSize: 12, fontWeight: 700, color: "var(--ah-text-secondary)",
                background: "var(--ah-bg)",
              }}
            >
              {dayLabel(dateKey)}
            </h2>
            {dayItems.map((item, i) => (
              <TimelineItem
                key={item.clientId}
                time={timeOf(item.at)}
                icon={item.icon}
                domainCssVar={item.domainCssVar}
                title={item.title}
                detail={item.detail}
                chip={item.chip}
                pendingSync={syncEnabled && (pendingIds?.has(item.clientId) ?? false)}
                isLast={i === dayItems.length - 1}
              />
            ))}
          </section>
        ))}
      </main>

      <QuickLogSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <AppNav activeKey="timeline" onLog={() => setSheetOpen(true)} />
    </>
  );
}
