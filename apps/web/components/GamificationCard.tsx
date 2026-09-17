"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import {
  computeXp, levelForXp, earnedBadges, missionStatus, bankedXp,
  BADGES, XP_RULES, type PlayerActivity, type TodayCounts,
} from "@arta/core";
import { playerActivity, todayCounts, persistedAchievements, grantAchievements } from "@/lib/gamification";
import { personalLeaderboard } from "@/lib/leaderboard";
import { featureLeaderboard } from "@/lib/features";
import { db } from "@/lib/db";

/**
 * Gamification (Fase 6 · GM-1/GM-2). Level/XP + badge + misi harian — DITURUNKAN dari
 * aktivitas (deterministik, tak bisa "curang") + PERSISTEN (GM-2): badge dicatat saat
 * diraih, bonus misi DIBANK per hari → XP bertahan lintas hari & perangkat. Reward untuk
 * perilaku sehat, tak menghukum ketiadaan data. Di balik flag NEXT_PUBLIC_FEATURE_GAMIFICATION.
 */

const EMPTY_ACT: PlayerActivity = {
  habitCompletions: 0, currentStreak: 0, longestStreak: 0, hydrationLogs: 0, sleepLogs: 0,
  activityLogs: 0, moodLogs: 0, weightLogs: 0, biomarkerReadings: 0, foodLogs: 0, productScans: 0,
};
const EMPTY_TODAY: TodayCounts = { logs: 0, hydration: 0, habits: 0 };
const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function GamificationCard() {
  const { show } = useToast();
  // liveQuery menonton semua tabel sumber → level/misi ikut naik begitu ada catatan baru.
  const dep = useLiveQuery(async () => {
    const c = await Promise.all([
      db.habit_completions.count(), db.hydration_logs.count(), db.food_logs.count(),
      db.biomarker_readings.count(), db.product_scans.count(),
    ]);
    return c.join(",");
  }, []);
  const activity = useLiveQuery(() => playerActivity(), [dep]) ?? EMPTY_ACT;
  const today = useLiveQuery(() => todayCounts(), [dep]) ?? EMPTY_TODAY;
  const persisted = useLiveQuery(() => persistedAchievements(), [dep]) ?? [];

  // Catat reward baru (badge/misi) di EFEK — bukan di liveQuery (hindari ReadOnlyError).
  useEffect(() => {
    void grantAchievements().then((newBadges) => {
      for (const key of newBadges) {
        const b = BADGES.find((x) => x.key === key);
        if (b) show({ message: `${b.icon} Lencana baru: ${b.label}!` });
      }
    });
  }, [dep, today.logs, today.hydration, today.habits, show]);

  const banked = bankedXp(persisted);
  const bankedToday = persisted
    .filter((r) => r.kind === "mission" && r.day === todayKey())
    .reduce((s, r) => s + r.xp, 0);
  const xp = computeXp(activity) + banked;
  const lv = levelForXp(xp);
  const earnedDate = new Map(persisted.filter((r) => r.kind === "badge").map((r) => [r.key, r.earnedAt]));
  const earned = new Set([...earnedBadges(activity).map((b) => b.key), ...earnedDate.keys()]);
  const missions = missionStatus(today);
  const missionsDone = missions.filter((m) => m.done).length;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={levelBadge}>
          <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, lineHeight: 1 }}>LV</span>
          <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{lv.level}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🎮 Petualangan Sehat</p>
          <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
            {xp.toLocaleString("id-ID")} XP{lv.xpForNext > 0 ? ` · ${lv.xpForNext - lv.xpIntoLevel} XP lagi ke Lv ${lv.level + 1}` : " · level maks"}
          </p>
          <div style={barTrack} aria-label={`Progres level ${Math.round(lv.progress * 100)}%`}>
            <div style={{ ...barFill, width: `${Math.round(lv.progress * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Misi harian */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={sectionLabel}>Misi hari ini · {missionsDone}/{missions.length} tuntas
          {bankedToday > 0 && <span style={{ color: "var(--ah-score-excellent)", marginLeft: 6 }}>+{bankedToday} XP</span>}
        </p>
        {missions.map(({ mission, current, done }) => (
          <div key={mission.key} style={missionRow}>
            <span style={{ fontSize: 16, opacity: done ? 1 : 0.55 }}>{done ? "✅" : mission.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ah-text-primary)", textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>
                {mission.label}
              </p>
              <div style={miniTrack}>
                <div style={{ ...miniFill, width: `${Math.round((current / mission.target) * 100)}%`, background: done ? "var(--ah-score-excellent)" : "var(--ah-cyan, #22D3EE)" }} />
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)", flexShrink: 0 }}>{current}/{mission.target}</span>
          </div>
        ))}
      </div>

      {/* Badge */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={sectionLabel}>Lencana · {earned.size}/{BADGES.length}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 6 }}>
          {BADGES.map((b) => {
            const has = earned.has(b.key);
            const on = earnedDate.get(b.key);
            const tip = `${b.label} — ${b.desc}${on ? ` · diraih ${new Date(on).toLocaleDateString("id-ID")}` : ""}`;
            return (
              <div key={b.key} title={tip} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px",
                borderRadius: "var(--ah-r-inner)", background: has ? "rgba(34,211,238,0.12)" : "var(--ah-surface-2)",
                border: has ? "1.5px solid var(--ah-cyan, #22D3EE)" : "1px solid var(--ah-border)",
                opacity: has ? 1 : 0.5,
              }}>
                <span style={{ fontSize: 20, filter: has ? "none" : "grayscale(1)" }}>{has ? b.icon : "🔒"}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ah-text-secondary)", textAlign: "center", lineHeight: 1.2 }}>{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Papan poin mingguan (LB-1) — dilebur ke sini agar tak dobel sistem poin (Fase 8 konsolidasi) */}
      {featureLeaderboard() && <WeeklyPointsSection />}

      {activity.currentStreak > 0 && (
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>
          🔥 Streak berjalan {activity.currentStreak} hari (+{activity.currentStreak * XP_RULES.streakDay} XP). Jaga terus!
        </p>
      )}
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Poin dihitung dari catatan aslimu — hadiah untuk kebiasaan sehat, bukan sekadar main.
      </p>
    </div>
  );
}

const DIR: Record<"up" | "down" | "flat", { icon: string; color: string; word: string }> = {
  up: { icon: "▲", color: "var(--ah-score-excellent)", word: "naik" },
  down: { icon: "▼", color: "var(--ah-score-low)", word: "turun" },
  flat: { icon: "▬", color: "var(--ah-text-tertiary)", word: "sama" },
};
const weekLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

/** Poin aktivitas mingguan (LB-1) sebagai SECTION di Petualangan Sehat — satu rumah gamifikasi. */
function WeeklyPointsSection() {
  const data = useLiveQuery(() => personalLeaderboard(), []);
  if (!data || !data.hasData) return null;
  const max = Math.max(1, ...data.weeks.map((w) => w.points));
  const dir = DIR[data.momentum.direction];
  const activeWeeks = data.weeks.filter((w) => w.events > 0).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={sectionLabel}>Papan poin mingguan</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1 }}>
          {data.momentum.current?.points ?? 0}
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ah-text-tertiary)" }}> poin · minggu ini</span>
        </p>
        <div style={{ ...pill, color: dir.color }}>{dir.icon} {Math.abs(data.momentum.delta)} {dir.word}</div>
        {data.momentum.isPersonalBest && <div style={{ ...pill, color: "var(--ah-score-excellent)" }}>⭐ rekor!</div>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 52 }}>
        {data.weeks.map((w, i) => {
          const isCurrent = i === data.weeks.length - 1;
          const isBest = data.best != null && w.weekKey === data.best.weekKey && w.points > 0;
          const h = Math.round((w.points / max) * 44) + 4;
          const color = isCurrent ? "var(--ah-accent)" : isBest ? "var(--ah-score-excellent)" : "var(--ah-surface-3, var(--ah-border))";
          return (
            <div key={w.weekKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
              title={`Minggu ${weekLabel(w.weekStartISO)}: ${w.points} poin`}>
              <div style={{ width: "100%", height: h, background: color, borderRadius: 4 }} />
              <span style={{ fontSize: 8, color: "var(--ah-text-tertiary)" }}>{weekLabel(w.weekStartISO)}</span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)" }}>
        {data.momentum.rankAmongWeeks != null
          ? `Minggu ini peringkat ${data.momentum.rankAmongWeeks} dari ${activeWeeks} minggu aktifmu.`
          : "Terus catat aktivitas untuk membangun momentum."}
        {data.best != null && data.best.points > 0 && ` Rekor: ${data.best.points} poin (${weekLabel(data.best.weekStartISO)}).`}
      </p>
    </div>
  );
}

const pill: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: "var(--ah-r-full)",
  background: "var(--ah-surface-2)", border: "1px solid var(--ah-border)",
};
const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 14,
};
const levelBadge: React.CSSProperties = {
  width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: "var(--ah-gradient-hero)",
  color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
};
const barTrack: React.CSSProperties = {
  height: 6, borderRadius: "var(--ah-r-full)", background: "var(--ah-surface-2)", marginTop: 6, overflow: "hidden",
};
const barFill: React.CSSProperties = {
  height: "100%", borderRadius: "var(--ah-r-full)", background: "var(--ah-gradient-hero)", transition: "width .3s",
};
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)" };
const missionRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, background: "var(--ah-surface-2)",
  borderRadius: "var(--ah-r-inner)", padding: "8px 12px",
};
const miniTrack: React.CSSProperties = {
  height: 4, borderRadius: "var(--ah-r-full)", background: "var(--ah-surface-1)", marginTop: 4, overflow: "hidden",
};
const miniFill: React.CSSProperties = { height: "100%", borderRadius: "var(--ah-r-full)", transition: "width .3s" };
