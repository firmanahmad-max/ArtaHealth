"use client";
import { useLiveQuery } from "dexie-react-hooks";
import {
  computeXp, levelForXp, earnedBadges, missionStatus, missionBonusXp,
  BADGES, XP_RULES, type PlayerActivity, type TodayCounts,
} from "@arta/core";
import { playerActivity, todayCounts } from "@/lib/gamification";
import { db } from "@/lib/db";

/**
 * Gamification (Fase 6 · GM-1). Level/XP + badge + misi harian — DITURUNKAN dari
 * aktivitas yang sudah dicatat (deterministik, tak bisa "curang"). Reward untuk
 * perilaku sehat, tak menghukum ketiadaan data. Persistensi (player_stats/
 * achievements) menyusul GM-2. Di balik flag NEXT_PUBLIC_FEATURE_GAMIFICATION.
 */

const EMPTY_ACT: PlayerActivity = {
  habitCompletions: 0, currentStreak: 0, longestStreak: 0, hydrationLogs: 0, sleepLogs: 0,
  activityLogs: 0, moodLogs: 0, weightLogs: 0, biomarkerReadings: 0, foodLogs: 0, productScans: 0,
};
const EMPTY_TODAY: TodayCounts = { logs: 0, hydration: 0, habits: 0 };

export function GamificationCard() {
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

  const baseXp = computeXp(activity);
  const bonus = missionBonusXp(today);
  const xp = baseXp + bonus;
  const lv = levelForXp(xp);
  const earned = new Set(earnedBadges(activity).map((b) => b.key));
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
          {bonus > 0 && <span style={{ color: "var(--ah-score-excellent)", marginLeft: 6 }}>+{bonus} XP</span>}
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
            return (
              <div key={b.key} title={`${b.label} — ${b.desc}`} style={{
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
