"use client";
import { useEffect, useState } from "react";
import { personalLeaderboard, type PersonalLeaderboard } from "@/lib/leaderboard";
import { useMounted } from "@/lib/useMounted";

/**
 * Leaderboard (backlog · LB-1) — papan PRIBADI: poin mingguanmu vs minggu-minggu lalumu (rekor
 * pribadi + momentum). 100% lokal, tanpa berbagi. Papan sosial (bandingkan dgn orang lain)
 * menyusul di balik gerbang privasi (LB-3). Flag NEXT_PUBLIC_FEATURE_LEADERBOARD.
 */

const DIR: Record<"up" | "down" | "flat", { icon: string; color: string; word: string }> = {
  up: { icon: "▲", color: "var(--ah-score-excellent)", word: "naik" },
  down: { icon: "▼", color: "var(--ah-score-low)", word: "turun" },
  flat: { icon: "▬", color: "var(--ah-text-tertiary)", word: "sama" },
};

const weekLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

export function LeaderboardCard() {
  const mounted = useMounted();
  const [data, setData] = useState<PersonalLeaderboard | null>(null);

  useEffect(() => {
    if (!mounted) return;
    void personalLeaderboard().then(setData);
  }, [mounted]);

  const max = data ? Math.max(1, ...data.weeks.map((w) => w.points)) : 1;
  const dir = data ? DIR[data.momentum.direction] : DIR.flat;

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🏆 Papan Poin Pribadi</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Poin aktivitas mingguanmu vs minggu-minggu lalumu — kalahkan dirimu sendiri.
        </p>
      </div>

      {!data || !data.hasData ? (
        <div style={emptyBox}>
          <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
            Belum ada aktivitas tercatat. Catat kebiasaan, tidur, atau pengukuran — poin mingguanmu akan muncul di sini.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--ah-text-primary)", lineHeight: 1 }}>
                {data.momentum.current?.points ?? 0}
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ah-text-tertiary)" }}> poin</span>
              </p>
              <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)", marginTop: 2 }}>minggu ini</p>
            </div>
            <div style={{ ...pill, color: dir.color }}>
              {dir.icon} {Math.abs(data.momentum.delta)} {dir.word}
            </div>
            {data.momentum.isPersonalBest && <div style={{ ...pill, color: "var(--ah-score-excellent)" }}>⭐ rekor!</div>}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 64 }}>
            {data.weeks.map((w, i) => {
              const isCurrent = i === data.weeks.length - 1;
              const isBest = data.best != null && w.weekKey === data.best.weekKey && w.points > 0;
              const h = Math.round((w.points / max) * 56) + 4;
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
              ? `Minggu ini peringkat ${data.momentum.rankAmongWeeks} dari ${data.weeks.filter((w) => w.events > 0).length} minggu aktifmu.`
              : "Terus catat aktivitas untuk membangun momentum."}
            {data.best != null && data.best.points > 0 && ` Rekor: ${data.best.points} poin (${weekLabel(data.best.weekStartISO)}).`}
          </p>
        </>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Poin dari aktivitas yang kamu catat (bukan nilai kesehatan), untuk memotivasi — bukan penilaian diri.
        Papan bersama antar-pengguna (opsional, anonim) menyusul.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const pill: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: "var(--ah-r-full)",
  background: "var(--ah-surface-2)", border: "1px solid var(--ah-border)",
};
const emptyBox: React.CSSProperties = {
  borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
  background: "var(--ah-surface-2)", border: "1px dashed var(--ah-border)",
};
