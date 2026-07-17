"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HealthRing, MetricCard, SkeletonCard, BottomNav, useToast } from "@arta/design-system";
import { computeHealthScore } from "@arta/core";
import { getSupabase, getPrimaryProfile } from "@/lib/supabase";

/**
 * Sprint 1 smoke page — memverifikasi token + HealthRing + scoring engine tersambung.
 * Akan digantikan Dashboard sesungguhnya di Sprint 3–4 (lihat CONTEXT.md §6
 * dan referensi interaksi di docs/prototypes/).
 */
export default function Home() {
  const router = useRouter();
  const { show } = useToast();
  const [waterMl, setWaterMl] = useState(2100);
  const { score, breakdown } = computeHealthScore({
    sleep: { durationMin: 465 },
    hydration: { intakeMl: waterMl, targetMl: 2500 },
    activity: { steps: 8456, stepTarget: 8000 },
    mood: 4,
    habits: { completed: 3, total: 5 },
  });

  // Guard sisi client (Sprint 1): tanpa sesi → /login; sesi tanpa onboarding → /onboarding.
  // Supabase belum dikonfigurasi (env kosong) → smoke page tetap tampil.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      const profile = await getPrimaryProfile();
      if (!profile?.onboarded_at) router.replace("/onboarding");
    });
  }, [router]);

  const logWater = () => {
    setWaterMl((v) => v + 250);
    show({ message: "Air 250 ml tercatat", onUndo: () => setWaterMl((v) => v - 250) });
  };

  return (
    <>
      <main style={{ maxWidth: 400, margin: "0 auto", padding: "16px 16px 96px", display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>ArtaHealth — Sprint 1 ✓</h1>
        <div style={{ background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-card)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <HealthRing score={score} />
          <button
            onClick={logWater}
            style={{ padding: "10px 18px", borderRadius: "var(--ah-r-full)", border: "none", background: "var(--ah-gradient-hero)", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            💧 Catat Air 250 ml → skor naik
          </button>
          <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", textAlign: "center" }}>
            Engine deterministik @arta/core · breakdown hidrasi: {String(breakdown.hydration)}
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <MetricCard icon="🌙" name="Tidur" value="7j 45m" chip="Baik" chipCssVar="var(--ah-score-excellent)" />
          <MetricCard icon="👟" name="Aktivitas" value="8.456" unit="lkh" chip="106%" chipCssVar="var(--ah-score-good)" />
          <MetricCard icon="💧" name="Hidrasi" value={`${(waterMl / 1000).toFixed(1)} L`} chip={waterMl >= 2500 ? "Tercapai" : `${Math.round((waterMl / 2500) * 100)}%`} chipCssVar={waterMl >= 2500 ? "var(--ah-score-excellent)" : "var(--ah-score-fair)"} />
          <MetricCard icon="🔥" name="Kalori" value={null} />
        </div>
        <SkeletonCard height={72} />
      </main>
      <BottomNav
        activeKey="home"
        onSelect={(key) => {
          if (key === "log") logWater(); // rute Catat/Timeline/Chat/Profil menyusul Sprint 3–6
        }}
        items={[
          { key: "home", label: "Beranda", icon: "🏠" },
          { key: "timeline", label: "Timeline", icon: "📈" },
          { key: "log", label: "Catat", icon: "＋", fab: true },
          { key: "chat", label: "Chat", icon: "💬" },
          { key: "profile", label: "Profil", icon: "👤" },
        ]}
      />
    </>
  );
}
