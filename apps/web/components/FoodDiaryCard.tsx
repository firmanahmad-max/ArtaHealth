"use client";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import {
  findFood, estimateNutrition, estimatePlate, resolveMeal,
  type FoodItem, type ServingNutrients,
} from "@arta/core";
import { scanMeal } from "@/lib/food";
import { logFood, todayGGLUsage } from "@/lib/nutrition";

/**
 * Food Diary AI (Fase 6 · FD-3). Foto masakan → identifikasi (vision) atau tambah
 * hidangan manual → daftar hidangan yang bisa DIKOREKSI porsinya → gizi total
 * DETERMINISTIK (FOOD_DB/TKPI) → catat ke food_logs (GGL Budget ter-update).
 * Framing "perkiraan": estimasi foto masakan < akurasi label. Di balik flag
 * NEXT_PUBLIC_FEATURE_FOOD_DIARY. FOOD_DB ditinjau ahli gizi vs TKPI (gerbang lulus, Agu 2026).
 */

type MealItem = { key: string; name: string; food: FoodItem; portionG: number };
type Meal = "sarapan" | "siang" | "malam" | "camilan";
const MEALS: [Meal, string][] = [["sarapan", "Sarapan"], ["siang", "Siang"], ["malam", "Malam"], ["camilan", "Camilan"]];

export function FoodDiaryCard() {
  const { show } = useToast();
  const usage = useLiveQuery(() => todayGGLUsage(), []) ?? { sugar: 0, sodium: 0, fat: 0 };

  const [items, setItems] = useState<MealItem[]>([]);
  const [meal, setMeal] = useState<Meal>("siang");
  const [dishInput, setDishInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFood = (food: FoodItem, name: string, portionG: number) =>
    setItems((xs) => [...xs, { key: crypto.randomUUID(), name, food, portionG }]);

  const addManual = () => {
    const q = dishInput.trim();
    if (!q) return;
    const food = findFood(q);
    if (!food) { show({ variant: "info", message: `"${q}" tak dikenal — coba nama umum (mis. "nasi goreng").` }); return; }
    addFood(food, food.name, food.typicalPortionG);
    setDishInput(""); setLogged(false);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true); setScanMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await scanMeal(String(reader.result));
      setScanning(false);
      if (!res.ok) { setScanMsg(res.message); return; }
      const resolved = resolveMeal(res.identified);
      setItems(resolved.items.map((i) => ({ key: crypto.randomUUID(), name: i.food.name, food: i.food, portionG: i.portionG })));
      if (res.identified.meal_type) setMeal(res.identified.meal_type);
      setLogged(false);
      setScanMsg(resolved.unresolved.length
        ? `Perkiraan dari foto. Tak dikenal: ${resolved.unresolved.join(", ")} — tambah manual bila perlu.`
        : "Perkiraan dari foto — cek porsi tiap hidangan, lalu catat.");
    };
    reader.readAsDataURL(file);
  };

  const setPortion = (key: string, g: number) =>
    setItems((xs) => xs.map((i) => (i.key === key ? { ...i, portionG: Math.max(0, g) } : i)));
  const removeItem = (key: string) => setItems((xs) => xs.filter((i) => i.key !== key));
  const reset = () => { setItems([]); setDishInput(""); setScanMsg(null); setLogged(false); };

  const total: ServingNutrients = estimatePlate(items.map((i) => ({ food: i.food, portionG: i.portionG })));
  const impact = { sugar: total.sugarG ?? 0, sodium: total.sodiumMg ?? 0, fat: total.totalFatG ?? 0 };

  const logMeal = async () => {
    if (items.length === 0) { show({ variant: "info", message: "Tambah minimal satu hidangan dulu." }); return; }
    await logFood({
      name: items.map((i) => i.name).join(", "),
      mealType: meal,
      sugarG: impact.sugar, sodiumMg: impact.sodium, fatG: impact.fat, energyKcal: total.energyKcal ?? 0,
    });
    setLogged(true);
    show({ message: `Tercatat ke Food Diary (${MEALS.find((m) => m[0] === meal)?.[1]}) — sisa jatah diperbarui` });
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🍽️ Catat Makan</p>
        {items.length > 0 && <button onClick={reset} style={ghostBtn}>Kosongkan</button>}
      </div>

      <div style={{ display: "inline-flex", gap: 4, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-full)", padding: 3, flexWrap: "wrap" }}>
        {MEALS.map(([v, label]) => (
          <button key={v} onClick={() => setMeal(v)} aria-pressed={meal === v}
            style={{
              minHeight: 30, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer",
              background: meal === v ? "var(--ah-gradient-hero)" : "transparent",
              color: meal === v ? "#fff" : "var(--ah-text-secondary)", fontSize: 11, fontWeight: 700,
            }}>
            {label}
          </button>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
      <button onClick={() => fileRef.current?.click()} disabled={scanning} style={{ ...secondaryBtn, opacity: scanning ? 0.6 : 1 }}>
        {scanning ? "Mengenali…" : "📷 Foto makanan"}
      </button>
      {scanMsg && <p style={scanNote}>{scanMsg}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={dishInput} onChange={(e) => setDishInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addManual(); }}
          placeholder="Tambah hidangan (mis. nasi goreng, ayam goreng)" style={input}
        />
        <button onClick={addManual} style={addBtn}>Tambah</button>
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((i) => {
            const n = estimateNutrition(i.food, i.portionG);
            return (
              <div key={i.key} style={row}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>{i.name}</p>
                  <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>{Math.round(n.energyKcal ?? 0)} kkal · {i.food.portionLabel}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    value={String(i.portionG)} onChange={(e) => setPortion(i.key, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
                    inputMode="numeric" aria-label={`Porsi ${i.name} gram`}
                    style={{ ...input, width: 62, textAlign: "right", minHeight: 36 }}
                  />
                  <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>g</span>
                  <button onClick={() => removeItem(i.key)} aria-label={`Hapus ${i.name}`} style={{ border: "none", background: "transparent", color: "var(--ah-text-tertiary)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)" }}>Perkiraan total</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ah-text-primary)", fontVariantNumeric: "tabular-nums" }}>{Math.round(total.energyKcal ?? 0)} kkal</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--ah-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
            🍬 gula {Math.round(impact.sugar)} g · 🧂 garam {Math.round(impact.sodium)} mg · 🫗 lemak {Math.round(impact.fat)} g
          </p>
        </div>
      )}

      <button onClick={() => void logMeal()} style={primaryBtn}>{logged ? "✓ Tercatat" : "Catat ke Food Diary"}</button>

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Perkiraan dari tabel komposisi pangan — koreksi porsi bila perlu. Estimasi foto masakan kurang akurat dari label kemasan.
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
const input: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const addBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const scanNote: React.CSSProperties = {
  fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.5,
  background: "rgba(251,191,36,0.12)", borderRadius: "var(--ah-r-inner)", padding: "8px 10px",
};
