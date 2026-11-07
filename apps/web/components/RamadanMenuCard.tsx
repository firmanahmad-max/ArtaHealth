"use client";
import { useEffect, useState } from "react";
import { useToast } from "@arta/design-system";
import type { MealPlan } from "@arta/core";
import { ramadanMenuToday, logMealPlan, type RamadanMenuContext } from "@/lib/ramadan-menu";
import { useMounted } from "@/lib/useMounted";
import { usePremium } from "@/lib/entitlement";
import { PremiumLocked } from "./PremiumLocked";

/**
 * Perencana Menu Sahur & Berbuka (Fase 9 · manfaat Paket Ramadan #3). Ide piring harian dari
 * FOOD_DB (ditinjau ahli gizi) yang muat di jatah GGL personal; bergiliran tiap hari; "Ganti ide"
 * menggeser rotasi; "Catat" ke Food Diary. Sembunyi di luar Ramadan. Non-medis.
 * Flag NEXT_PUBLIC_FEATURE_RAMADAN_MENU.
 */

export function RamadanMenuCard() {
  const mounted = useMounted();
  const { show } = useToast();
  const [shift, setShift] = useState(0);
  const [ctx, setCtx] = useState<RamadanMenuContext | null>(null);
  const [tab, setTab] = useState<"sahur" | "berbuka">(() => (new Date().getHours() < 12 ? "sahur" : "berbuka"));
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const allowed = usePremium("ramadan_menu");

  useEffect(() => {
    if (!mounted) return;
    void ramadanMenuToday(shift).then(setCtx);
  }, [mounted, shift]);

  if (!ctx || allowed === undefined) return null;
  if (!allowed) {
    return <PremiumLocked title="Menu Sahur & Berbuka" desc="Ide piring sahur & berbuka harian yang muat di jatah gizimu, bisa langsung dicatat ke Food Diary." />;
  }
  const meal: MealPlan = ctx.plan[tab];
  const key = `${tab}:${shift}`;

  const log = async () => {
    await logMealPlan(meal);
    setLogged((s) => new Set(s).add(key));
    show({ message: `Menu ${tab === "sahur" ? "sahur" : "berbuka"} tercatat di Food Diary` });
  };

  const pct = (used: number, budget: number) => Math.round((used / budget) * 100);

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🍽️ Menu Sahur & Berbuka</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Hari ke-{ctx.dayNumber} dari {ctx.totalDays} · ide piring yang muat di jatah gizimu.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {(["sahur", "berbuka"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} style={chip(tab === t)}>
            {t === "sahur" ? "🌙 Sahur" : "🌇 Berbuka"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {meal.items.map((it) => (
          <div key={it.food.id} style={row}>
            <span style={{ fontSize: 10, color: "var(--ah-text-tertiary)", width: 78, flexShrink: 0 }}>{it.role}</span>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "var(--ah-text-primary)" }}>{it.food.name}</span>
            <span style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)" }}>{it.food.portionLabel}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: "var(--ah-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
        Perkiraan piring ini: 🍬 {Math.round(meal.totals.sugarG ?? 0)} g · 🧂 {meal.totals.sodiumMg ?? 0} mg · 🫗 {Math.round(meal.totals.totalFatG ?? 0)} g
        {" · "}{Math.round(meal.totals.energyKcal ?? 0)} kkal
      </p>
      <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)" }}>
        Sahur + berbuka memakai ±{pct(ctx.plan.used.sodium, ctx.plan.budget.sodium)}% jatah natrium &amp; ±{pct(ctx.plan.used.sugar, ctx.plan.budget.sugar)}% jatah gula harianmu.
      </p>
      {meal.overBudget && (
        <p style={{ fontSize: 11, color: "var(--ah-score-fair)" }}>
          Piring ini sedikit melewati jatah per makan — kurangi porsi lauk atau kuahnya.
        </p>
      )}

      <ul style={{ display: "flex", flexDirection: "column", gap: 3, listStyle: "none" }}>
        {meal.tips.map((t) => (
          <li key={t} style={{ fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.45, display: "flex", gap: 6 }}>
            <span aria-hidden>💡</span>{t}
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void log()} disabled={logged.has(key)} style={primaryBtn}>
          {logged.has(key) ? "✓ Tercatat" : "Catat ke Food Diary"}
        </button>
        <button onClick={() => setShift((s) => s + 1)} style={ghostBtn}>🔄 Ganti ide</button>
      </div>
      <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Ide menu umum berbasis Tabel Komposisi Pangan (perkiraan), bukan diet terapi. Ikuti anjuran dokter/ahli gizi bila punya kondisi khusus.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 10,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
  borderRadius: "var(--ah-r-inner)", background: "var(--ah-surface-2)",
};
const chip = (active: boolean): React.CSSProperties => ({
  minHeight: 32, padding: "0 14px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
  border: active ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
  background: active ? "rgba(34,211,238,0.14)" : "var(--ah-surface-2)",
  color: "var(--ah-text-primary)", fontSize: 12, fontWeight: 700,
});
const primaryBtn: React.CSSProperties = {
  flex: 1, minHeight: 40, borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 12.5, fontWeight: 700,
};
const ghostBtn: React.CSSProperties = {
  minHeight: 40, padding: "0 14px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
  border: "1px solid var(--ah-border)", background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12.5, fontWeight: 700,
};
