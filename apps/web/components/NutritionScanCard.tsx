"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import {
  dailyBudget, type NutritionInput, type NutritionVerdict, type NutritionZone,
  type NutritionCondition, type Nutrient,
} from "@arta/core";
import {
  computeVerdict, nutritionConditions, todayGGLUsage, logFood, saveScan,
} from "@/lib/nutrition";

/**
 * Sadar Gizi — kartu hasil verdict (Fase 4 · NG-3). Jalur entri MANUAL nilai gizi
 * (pemindaian kamera/vision menyusul di NG-3b saat Edge Function di-deploy).
 * Menegakkan prinsip addendum: traffic-light per 100 g/ml + dampak GGL Budget
 * PER KEMASAN (bongkar jebakan takaran saji) + personalisasi kondisi terpantau.
 * Verdict deterministik (engine core), bukan AI. Di balik flag NEXT_PUBLIC_FEATURE_NUTRITION.
 * ⚠️ Ambang gizi masih kerangka — menunggu review ahli gizi/BPOM sebelum flag nyala.
 */

const ZONE_COLOR: Record<NutritionZone, string> = {
  green: "var(--ah-score-excellent)", yellow: "var(--ah-score-fair)", red: "var(--ah-score-low)",
};
const ZONE_EMOJI: Record<NutritionZone, string> = { green: "🟢", yellow: "🟡", red: "🔴" };
const NUTRIENT_LABEL: Record<Nutrient, string> = {
  sugar: "Gula", sodium: "Natrium", sat_fat: "Lemak jenuh",
  total_fat: "Lemak total", fiber: "Serat", protein: "Protein",
};

type Form = {
  name: string; foodForm: "solid" | "beverage"; servingSize: string; servingsPerPack: string;
  energyKcal: string; sugarG: string; sodiumMg: string; satFatG: string;
  totalFatG: string; carbG: string; fiberG: string; proteinG: string;
};
const EMPTY: Form = {
  name: "", foodForm: "solid", servingSize: "", servingsPerPack: "1",
  energyKcal: "", sugarG: "", sodiumMg: "", satFatG: "",
  totalFatG: "", carbG: "", fiberG: "", proteinG: "",
};

const num = (s: string): number => {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export function NutritionScanCard() {
  const { show } = useToast();
  const conditions = useLiveQuery(() => nutritionConditions(), []) ?? [];
  const usage = useLiveQuery(() => todayGGLUsage(), []) ?? { sugar: 0, sodium: 0, fat: 0 };

  const [form, setForm] = useState<Form>(EMPTY);
  const [result, setResult] = useState<{ input: NutritionInput; verdict: NutritionVerdict } | null>(null);
  const [basis, setBasis] = useState<"package" | "serving">("package");
  const [saved, setSaved] = useState(false);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const evaluate = () => {
    const size = num(form.servingSize);
    if (size <= 0) {
      show({ variant: "info", message: "Isi ukuran takaran saji (g/ml) lebih dari 0." });
      return;
    }
    const input: NutritionInput = {
      foodForm: form.foodForm,
      servingSize: size,
      servingsPerPack: Math.max(1, num(form.servingsPerPack)),
      serving: {
        energyKcal: num(form.energyKcal), sugarG: num(form.sugarG), sodiumMg: num(form.sodiumMg),
        satFatG: num(form.satFatG), totalFatG: num(form.totalFatG), carbG: num(form.carbG),
        fiberG: num(form.fiberG), proteinG: num(form.proteinG),
      },
    };
    setResult({ input, verdict: computeVerdict(input, conditions) });
    setBasis("package");
    setSaved(false);
  };

  const reset = () => { setForm(EMPTY); setResult(null); setSaved(false); };

  return (
    <div style={card}>
      <style>{"@keyframes ah-pulse{0%,100%{opacity:1}50%{opacity:.45}}"}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🥗 Sadar Gizi</p>
        {result && <button onClick={reset} style={ghostBtn}>Produk lain</button>}
      </div>

      {!result ? (
        <>
          <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
            Salin angka dari tabel <strong>Informasi Nilai Gizi</strong> (per takaran saji). Kami nilai
            dampaknya <strong>per kemasan</strong> terhadap anggaran harian Anda — bukan sekadar per sajian.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama produk (opsional)" style={input} />
            <div style={{ display: "flex", gap: 6 }}>
              <FormToggle
                value={form.foodForm}
                onChange={(v) => set("foodForm", v)}
                options={[["solid", "Padat"], ["beverage", "Minuman"]]}
              />
            </div>
            <div style={grid2}>
              <Field label="Takaran saji" unit={form.foodForm === "beverage" ? "ml" : "g"} value={form.servingSize} onChange={(v) => set("servingSize", v)} />
              <Field label="Sajian / kemasan" unit="×" value={form.servingsPerPack} onChange={(v) => set("servingsPerPack", v)} />
            </div>
            <p style={sectionLabel}>Per takaran saji</p>
            <div style={grid2}>
              <Field label="Energi" unit="kkal" value={form.energyKcal} onChange={(v) => set("energyKcal", v)} />
              <Field label="Gula" unit="g" value={form.sugarG} onChange={(v) => set("sugarG", v)} />
              <Field label="Natrium" unit="mg" value={form.sodiumMg} onChange={(v) => set("sodiumMg", v)} />
              <Field label="Lemak jenuh" unit="g" value={form.satFatG} onChange={(v) => set("satFatG", v)} />
              <Field label="Lemak total" unit="g" value={form.totalFatG} onChange={(v) => set("totalFatG", v)} />
              <Field label="Karbohidrat" unit="g" value={form.carbG} onChange={(v) => set("carbG", v)} />
              <Field label="Serat" unit="g" value={form.fiberG} onChange={(v) => set("fiberG", v)} />
              <Field label="Protein" unit="g" value={form.proteinG} onChange={(v) => set("proteinG", v)} />
            </div>
            <button onClick={evaluate} style={primaryBtn}>Nilai gizi</button>
          </div>
        </>
      ) : (
        <VerdictView
          input={result.input} verdict={result.verdict} conditions={conditions}
          usage={usage} basis={basis} onBasis={setBasis} name={form.name}
          saved={saved}
          onLog={async () => {
            const mult = basis === "package" ? result.input.servingsPerPack : 1;
            const s = result.input.serving;
            await logFood({
              name: form.name || undefined,
              sugarG: (s.sugarG ?? 0) * mult, sodiumMg: (s.sodiumMg ?? 0) * mult,
              fatG: (s.totalFatG ?? 0) * mult, energyKcal: (s.energyKcal ?? 0) * mult,
              sourceScanId: await saveScan({
                productName: form.name || undefined, foodForm: result.input.foodForm,
                extracted: result.input, verdict: result.verdict,
              }),
            });
            setSaved(true);
            show({ message: `Tercatat ke Food Diary (${basis === "package" ? "per kemasan" : "per sajian"}) — sisa jatah diperbarui` });
          }}
          onSave={async () => {
            await saveScan({ productName: form.name || undefined, foodForm: result.input.foodForm, extracted: result.input, verdict: result.verdict });
            setSaved(true);
            show({ message: "Hasil disimpan" });
          }}
        />
      )}
    </div>
  );
}

function VerdictView({
  input, verdict, conditions, usage, basis, onBasis, name, saved, onLog, onSave,
}: {
  input: NutritionInput; verdict: NutritionVerdict; conditions: NutritionCondition[];
  usage: { sugar: number; sodium: number; fat: number };
  basis: "package" | "serving"; onBasis: (b: "package" | "serving") => void;
  name: string; saved: boolean; onLog: () => Promise<void>; onSave: () => Promise<void>;
}) {
  const budget = dailyBudget(conditions);
  const mult = basis === "package" ? input.servingsPerPack : 1;
  const s = input.serving;
  const impact = {
    sugar: (s.sugarG ?? 0) * mult,
    sodium: (s.sodiumMg ?? 0) * mult,
    fat: (s.totalFatG ?? 0) * mult,
  };
  const bars: { key: "sugar" | "sodium" | "fat"; label: string; unit: string; primary: boolean }[] = [
    { key: "sugar", label: "Gula", unit: "g", primary: verdict.primaryNutrient === "sugar" },
    { key: "sodium", label: "Garam (natrium)", unit: "mg", primary: verdict.primaryNutrient === "sodium" },
    { key: "fat", label: "Lemak", unit: "g", primary: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Verdict badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "12px 14px", borderLeft: `4px solid ${ZONE_COLOR[verdict.overall]}` }}>
        <span style={{ fontSize: 26 }}>{ZONE_EMOJI[verdict.overall]}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: "var(--ah-text-primary)" }}>{verdict.headline}</p>
          {name && <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>{name}</p>}
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--ah-text-primary)", lineHeight: 1.5 }}>{verdict.reason}</p>
      <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>{verdict.suggestion}</p>

      {/* Serving basis toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Dampak dihitung:</span>
        <FormToggle
          value={basis}
          onChange={(v) => onBasis(v as "package" | "serving")}
          options={[["package", `Per kemasan (${input.servingsPerPack}×)`], ["serving", "Per sajian"]]}
        />
      </div>

      {/* GGL Budget bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={sectionLabel}>Anggaran GGL harian {conditions.includes("hypertension") && <span style={{ color: "var(--ah-score-fair)" }}>· natrium lebih ketat</span>}</p>
        {bars.map((b) => (
          <BudgetBar
            key={b.key} label={b.label} unit={b.unit} primary={b.primary}
            used={usage[b.key]} impact={impact[b.key]} budget={budget[b.key]}
          />
        ))}
      </div>

      {/* Per-nutrient traffic light */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {verdict.perNutrient.map((p) => (
          <span key={p.nutrient} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--ah-text-primary)", background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-full)", padding: "5px 10px" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ZONE_COLOR[p.zone] }} />
            {NUTRIENT_LABEL[p.nutrient]} {Math.round(p.per100)}<span style={{ color: "var(--ah-text-tertiary)", fontWeight: 500 }}>/100{input.foodForm === "beverage" ? "ml" : "g"}</span>
          </span>
        ))}
      </div>

      {/* Flags */}
      {verdict.flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {verdict.flags.map((f, i) => (
            <p key={i} style={{ fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>{f}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void onLog()} style={{ ...primaryBtn, flex: 1 }}>{saved ? "✓ Tercatat" : "Catat ke Food Diary"}</button>
        <button onClick={() => void onSave()} style={secondaryBtn}>Simpan</button>
      </div>
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Anggaran = pemandu, bukan larangan. Ambang gizi masih kerangka & menunggu verifikasi ahli gizi.
      </p>
    </div>
  );
}

function BudgetBar({ label, unit, used, impact, budget, primary }: {
  label: string; unit: string; used: number; impact: number; budget: number; primary: boolean;
}) {
  const usedPct = budget > 0 ? (used / budget) * 100 : 0;
  const impactPct = budget > 0 ? (impact / budget) * 100 : 0;
  const totalPct = Math.round(usedPct + impactPct);
  const over = usedPct + impactPct > 100;
  const fmt = (v: number) => (unit === "mg" ? Math.round(v) : Math.round(v * 10) / 10);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)" }}>
          {label}{primary && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ah-score-fair)", marginLeft: 6 }}>DIPANTAU</span>}
        </span>
        <span style={{ fontSize: 11, color: over ? "var(--ah-score-low)" : "var(--ah-text-tertiary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalPct}% jatah</span>
      </div>
      <div style={{ position: "relative", height: 10, borderRadius: "var(--ah-r-full)", background: "var(--ah-surface-3, rgba(255,255,255,0.06))", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, usedPct)}%`, background: "var(--ah-text-tertiary)", opacity: 0.55 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, usedPct)}%`, width: `${Math.min(100 - Math.min(100, usedPct), impactPct)}%`, background: over ? "var(--ah-score-low)" : "var(--ah-cyan, #22D3EE)", animation: "ah-pulse 1.4s ease-in-out infinite" }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--ah-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
        Terpakai {fmt(used)} + produk {fmt(impact)} {unit} / {fmt(budget)} {unit}
      </span>
    </div>
  );
}

function FormToggle({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div style={{ display: "inline-flex", gap: 4, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-full)", padding: 3 }}>
      {options.map(([v, label]) => (
        <button
          key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          style={{
            minHeight: 30, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer",
            background: value === v ? "var(--ah-gradient-hero)" : "transparent",
            color: value === v ? "#fff" : "var(--ah-text-secondary)", fontSize: 11, fontWeight: 700,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, unit, value, onChange }: {
  label: string; unit: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>{label} <span style={{ opacity: 0.6 }}>({unit})</span></span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        inputMode="decimal" placeholder="0" style={input}
      />
    </label>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 };
const input: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 14, width: "100%",
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
