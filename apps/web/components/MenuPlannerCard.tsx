"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import {
  suggestMeals, dailyBudget, estimateNutrition,
  type FoodItem, type MealSuggestion,
} from "@arta/core";
import { nutritionConditions, todayGGLUsage, logFood } from "@/lib/nutrition";

/**
 * Perencana Menu (Fase 6 · FD-4). Dari SISA anggaran GGL hari ini (todayGGLUsage vs
 * dailyBudget) → `suggestMeals` deterministik: hidangan yang MUAT di sisa anggaran,
 * personalisasi hipertensi (utamakan natrium rendah). Quick-log ke food_logs.
 * Di balik flag NEXT_PUBLIC_FEATURE_FOOD_DIARY. FOOD_DB kerangka — menunggu review TKPI.
 */

const CATS: [FoodItem["category"] | "all", string][] = [
  ["all", "Semua"], ["nasi", "Nasi"], ["lauk", "Lauk"], ["sayur", "Sayur"],
  ["sup", "Sup"], ["buah", "Buah"], ["minuman", "Minuman"],
];

export function MenuPlannerCard() {
  const { show } = useToast();
  const conditions = useLiveQuery(() => nutritionConditions(), []) ?? [];
  const usage = useLiveQuery(() => todayGGLUsage(), []) ?? { sugar: 0, sodium: 0, fat: 0 };
  const [cat, setCat] = useState<FoodItem["category"] | "all">("all");
  const [logged, setLogged] = useState<Set<string>>(new Set());

  const hyper = conditions.includes("hypertension");
  const budget = dailyBudget(conditions);
  const remaining = {
    sugar: Math.max(0, budget.sugar - usage.sugar),
    sodium: Math.max(0, budget.sodium - usage.sodium),
    fat: Math.max(0, budget.fat - usage.fat),
  };
  const suggestions = suggestMeals(remaining, {
    hypertension: hyper, limit: 6, category: cat === "all" ? undefined : cat,
  });

  const quickLog = async (m: MealSuggestion) => {
    const n = estimateNutrition(m.food, m.portionG);
    await logFood({
      name: m.food.name, mealType: "camilan",
      sugarG: m.impact.sugar, sodiumMg: m.impact.sodium, fatG: m.impact.fat, energyKcal: n.energyKcal ?? 0,
    });
    setLogged((s) => new Set(s).add(m.food.id));
    show({ message: `${m.food.name} tercatat — sisa jatah diperbarui` });
  };

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🍱 Perencana Menu</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Ide makan yang muat di sisa jatah hari ini{hyper ? " · natrium lebih ketat" : ""}.
        </p>
      </div>

      <p style={{ fontSize: 11, color: "var(--ah-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
        Sisa jatah: 🍬 {Math.round(remaining.sugar)} g · 🧂 {Math.round(remaining.sodium)} mg · 🫗 {Math.round(remaining.fat)} g
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CATS.map(([v, label]) => (
          <button key={v} onClick={() => setCat(v)} aria-pressed={cat === v}
            style={{
              minHeight: 30, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
              border: cat === v ? "1.5px solid var(--ah-cyan, #22D3EE)" : "1px solid var(--ah-border)",
              background: cat === v ? "rgba(34,211,238,0.14)" : "var(--ah-surface-2)",
              color: "var(--ah-text-primary)", fontSize: 11, fontWeight: 700,
            }}>
            {label}
          </button>
        ))}
      </div>

      {suggestions.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px" }}>
          {remaining.sugar + remaining.sodium + remaining.fat <= 0
            ? "Jatah hari ini sudah penuh — pilih porsi kecil, buah, atau minuman tawar."
            : "Tak ada hidangan di kategori ini yang muat di sisa jatah. Coba kategori lain atau porsi lebih kecil."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {suggestions.map((m) => {
            const kcal = Math.round(estimateNutrition(m.food, m.portionG).energyKcal ?? 0);
            const done = logged.has(m.food.id);
            return (
              <div key={m.food.id} style={row}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>{m.food.name}</p>
                  <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                    {kcal} kkal · {m.food.portionLabel} · 🧂 {m.impact.sodium} mg
                  </p>
                </div>
                <button onClick={() => void quickLog(m)} disabled={done} style={{ ...logBtn, opacity: done ? 0.5 : 1 }}>
                  {done ? "✓" : "+ Catat"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Saran = pemandu porsi, bukan resep diet. Nilai gizi perkiraan (tabel komposisi pangan).
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "8px 12px",
};
const logBtn: React.CSSProperties = {
  minHeight: 34, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
