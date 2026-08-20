"use client";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import {
  dailyBudget, detectAllergens,
  type NutritionInput, type NutritionVerdict, type NutritionZone,
  type NutritionCondition, type Nutrient, type AllergenMatch, type SelectedAllergen,
} from "@arta/core";
import type { LocalSavedProduct } from "@/lib/db";
import {
  computeVerdict, todayGGLUsage, logFood, saveScan,
  scanLabel, savedProducts, saveProduct, removeSavedProduct,
} from "@/lib/nutrition";
import { eaters, eaterContext, type EaterContext } from "@/lib/eaters";

/**
 * Sadar Gizi — kartu hasil verdict (Fase 4 · NG-3). Jalur entri MANUAL + PINDAI FOTO
 * (Edge Function vision `nutrition-scan`; turun anggun bila belum aktif). Menegakkan
 * prinsip addendum: traffic-light per 100 g/ml + dampak GGL Budget PER KEMASAN
 * (bongkar jebakan takaran saji) + personalisasi kondisi terpantau. Verdict
 * deterministik (engine core), bukan AI. NG-3b menambah: konfirmasi field confidence
 * rendah, lemari produk (Simpan Produk), dan Pindai Pembanding. NG-4 menambah deteksi
 * ALERGEN dari daftar bahan (alert di atas verdict; hanya menandai kemungkinan).
 * Di balik flag NEXT_PUBLIC_FEATURE_NUTRITION.
 * Ambang gizi ditinjau & disetujui ahli gizi (gerbang §10 lulus, Agu 2026).
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
  totalFatG: string; carbG: string; fiberG: string; proteinG: string; ingredients: string;
};
const EMPTY: Form = {
  name: "", foodForm: "solid", servingSize: "", servingsPerPack: "1",
  energyKcal: "", sugarG: "", sodiumMg: "", satFatG: "",
  totalFatG: "", carbG: "", fiberG: "", proteinG: "", ingredients: "",
};

const num = (s: string): number => {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};
const str = (v?: number): string => (v === undefined || v === null || v === 0 ? (v === 0 ? "0" : "") : String(v));

function inputToForm(input: NutritionInput, name?: string): Form {
  const s = input.serving;
  return {
    name: name ?? "", foodForm: input.foodForm,
    servingSize: str(input.servingSize), servingsPerPack: str(input.servingsPerPack),
    energyKcal: str(s.energyKcal), sugarG: str(s.sugarG), sodiumMg: str(s.sodiumMg),
    satFatG: str(s.satFatG), totalFatG: str(s.totalFatG), carbG: str(s.carbG),
    fiberG: str(s.fiberG), proteinG: str(s.proteinG), ingredients: "",
  };
}

// snake_case field / confidence key → field form yang perlu ditandai "periksa"
const FIELD_TOKENS: [keyof Form, string[]][] = [
  ["sodiumMg", ["sodium", "natrium"]], ["energyKcal", ["energy", "energi"]], ["sugarG", ["sugar", "gula"]],
  ["satFatG", ["sat_fat", "saturated"]], ["totalFatG", ["fat_g", "lemak"]], ["carbG", ["carb"]],
  ["fiberG", ["fiber", "serat"]], ["proteinG", ["protein"]],
  ["servingsPerPack", ["servings_per_pack", "sajian"]], ["servingSize", ["serving_size", "takaran"]],
];
function warnsFrom(recheck: string[]): Set<keyof Form> {
  const set = new Set<keyof Form>();
  for (const r of recheck) {
    const low = r.toLowerCase();
    for (const [field, toks] of FIELD_TOKENS) if (toks.some((t) => low.includes(t))) set.add(field);
  }
  return set;
}

const SELF_CONTEXT: EaterContext = { id: "self", name: "Saya", conditions: [], allergens: [], isSelf: true };

export function NutritionScanCard() {
  const { show } = useToast();
  const usage = useLiveQuery(() => todayGGLUsage(), []) ?? { sugar: 0, sodium: 0, fat: 0 };
  const saved = useLiveQuery(() => savedProducts(), []) ?? [];
  const eaterList = useLiveQuery(() => eaters(), []) ?? [];

  const [eaterId, setEaterId] = useState<string>("self");
  const context = useLiveQuery(() => eaterContext(eaterId), [eaterId]) ?? SELF_CONTEXT;

  const [form, setForm] = useState<Form>(EMPTY);
  const [result, setResult] = useState<{ input: NutritionInput; ingredients: string } | null>(null);
  const [basis, setBasis] = useState<"package" | "serving">("package");
  const [logged, setLogged] = useState(false);
  const [warns, setWarns] = useState<Set<keyof Form>>(new Set());
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showLemari, setShowLemari] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // verdict & alergen DIHITUNG dari konteks orang terpilih → ganti orang = live re-personalisasi
  const verdict = result ? computeVerdict(result.input, context.conditions) : null;
  const allergens: AllergenMatch[] = result && result.ingredients
    ? detectAllergens(result.ingredients, context.allergens as SelectedAllergen[]) : [];

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (warns.has(k)) setWarns((w) => { const n = new Set(w); n.delete(k); return n; });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true); setScanMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await scanLabel(String(reader.result));
      setScanning(false);
      if (!res.ok) { setScanMsg(res.message); return; }
      setForm({ ...inputToForm(res.input, res.extracted.product_guess), ingredients: res.extracted.ingredients_raw ?? "" });
      setWarns(warnsFrom(res.sanity.recheck));
      setResult(null);
      setScanMsg(res.sanity.needsConfirmation
        ? "Periksa angka bertanda sebelum menilai — hasil pindai bisa keliru."
        : "Angka terisi dari foto. Cek sekilas, lalu nilai.");
    };
    reader.readAsDataURL(file);
  };

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
    setResult({ input, ingredients: form.ingredients });
    setBasis("package"); setLogged(false); setScanMsg(null);
  };

  const reset = () => { setForm(EMPTY); setResult(null); setLogged(false); setWarns(new Set()); setScanMsg(null); };

  const loadSaved = (p: LocalSavedProduct) => {
    const input = p.extracted as NutritionInput;
    setForm(inputToForm(input, p.productName));
    setResult({ input, ingredients: "" });
    setBasis("package"); setLogged(false); setWarns(new Set()); setScanMsg(null); setShowLemari(false);
  };

  return (
    <div style={card}>
      <style>{"@keyframes ah-pulse{0%,100%{opacity:1}50%{opacity:.45}}"}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🥗 Sadar Gizi</p>
        <div style={{ display: "flex", gap: 6 }}>
          {saved.length > 0 && <button onClick={() => setShowLemari((v) => !v)} style={ghostBtn}>🗄️ Lemari ({saved.length})</button>}
          {result && <button onClick={reset} style={ghostBtn}>Produk lain</button>}
        </div>
      </div>

      {eaterList.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Pindai untuk:</span>
          <div style={{ display: "inline-flex", gap: 4, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-full)", padding: 3, flexWrap: "wrap" }}>
            {[{ id: "self", name: "Saya" }, ...eaterList].map((e) => (
              <button
                key={e.id} onClick={() => setEaterId(e.id)} aria-pressed={eaterId === e.id}
                style={{
                  minHeight: 28, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer",
                  background: eaterId === e.id ? "var(--ah-gradient-hero)" : "transparent",
                  color: eaterId === e.id ? "#fff" : "var(--ah-text-secondary)", fontSize: 11, fontWeight: 700,
                }}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showLemari && (
        <Lemari products={saved} onLoad={loadSaved} onRemove={(id) => void removeSavedProduct(id)} />
      )}

      {!result ? (
        <>
          <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
            Foto tabel <strong>Informasi Nilai Gizi</strong> atau salin angkanya (per takaran saji). Kami nilai
            dampaknya <strong>per kemasan</strong> terhadap anggaran harian Anda — bukan sekadar per sajian.
          </p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} disabled={scanning} style={{ ...secondaryBtn, opacity: scanning ? 0.6 : 1 }}>
            {scanning ? "Memindai…" : "📷 Pindai label"}
          </button>
          {scanMsg && <p style={scanNote}>{scanMsg}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama produk (opsional)" style={input} />
            <div style={{ display: "flex", gap: 6 }}>
              <FormToggle value={form.foodForm} onChange={(v) => set("foodForm", v)} options={[["solid", "Padat"], ["beverage", "Minuman"]]} />
            </div>
            <div style={grid2}>
              <Field label="Takaran saji" unit={form.foodForm === "beverage" ? "ml" : "g"} value={form.servingSize} warn={warns.has("servingSize")} onChange={(v) => set("servingSize", v)} />
              <Field label="Sajian / kemasan" unit="×" value={form.servingsPerPack} warn={warns.has("servingsPerPack")} onChange={(v) => set("servingsPerPack", v)} />
            </div>
            <p style={sectionLabel}>Per takaran saji</p>
            <div style={grid2}>
              <Field label="Energi" unit="kkal" value={form.energyKcal} warn={warns.has("energyKcal")} onChange={(v) => set("energyKcal", v)} />
              <Field label="Gula" unit="g" value={form.sugarG} warn={warns.has("sugarG")} onChange={(v) => set("sugarG", v)} />
              <Field label="Natrium" unit="mg" value={form.sodiumMg} warn={warns.has("sodiumMg")} onChange={(v) => set("sodiumMg", v)} />
              <Field label="Lemak jenuh" unit="g" value={form.satFatG} warn={warns.has("satFatG")} onChange={(v) => set("satFatG", v)} />
              <Field label="Lemak total" unit="g" value={form.totalFatG} warn={warns.has("totalFatG")} onChange={(v) => set("totalFatG", v)} />
              <Field label="Karbohidrat" unit="g" value={form.carbG} warn={warns.has("carbG")} onChange={(v) => set("carbG", v)} />
              <Field label="Serat" unit="g" value={form.fiberG} warn={warns.has("fiberG")} onChange={(v) => set("fiberG", v)} />
              <Field label="Protein" unit="g" value={form.proteinG} warn={warns.has("proteinG")} onChange={(v) => set("proteinG", v)} />
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={sectionLabel}>Daftar bahan <span style={{ textTransform: "none", fontWeight: 500, opacity: 0.7 }}>(untuk cek alergen)</span></span>
              <textarea
                value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)}
                placeholder="Tempel daftar bahan, mis. Tepung terigu, gula, susu bubuk, lesitin kedelai…"
                rows={2}
                style={{ ...input, minHeight: 56, padding: "10px 12px", resize: "vertical", lineHeight: 1.5 }}
              />
            </label>
            <button onClick={evaluate} style={primaryBtn}>Nilai gizi</button>
          </div>
        </>
      ) : verdict && (
        <VerdictView
          input={result.input} verdict={verdict} allergens={allergens} context={context}
          usage={usage} basis={basis} onBasis={setBasis} name={form.name} logged={logged}
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
                extracted: result.input, verdict,
              }),
            });
            setLogged(true);
            show({ message: `Tercatat ke Food Diary (${basis === "package" ? "per kemasan" : "per sajian"}) — sisa jatah diperbarui` });
          }}
          onSaveProduct={async () => {
            if (!form.name.trim()) { show({ variant: "info", message: "Beri nama produk dulu untuk menyimpannya ke lemari." }); return; }
            await saveProduct({ productName: form.name, foodForm: result.input.foodForm, input: result.input, verdict });
            show({ message: `“${form.name.trim()}” disimpan ke lemari` });
          }}
        />
      )}
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Anggaran = pemandu, bukan larangan. Angka mengikuti label — verifikasi field bertanda bila ragu.
      </p>
    </div>
  );
}

function AllergenAlert({ matches }: { matches: AllergenMatch[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(248,113,113,0.14)", border: "1.5px solid var(--ah-score-low)", borderRadius: "var(--ah-r-inner)", padding: "12px 14px" }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: "var(--ah-text-primary)" }}>⚠️ Kemungkinan mengandung alergen Anda</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {matches.map((m) => (
          <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)", background: "var(--ah-surface-1)", borderRadius: "var(--ah-r-full)", padding: "5px 10px" }}>
            {m.icon} {m.label} <span style={{ color: "var(--ah-text-tertiary)", fontWeight: 500 }}>· “{m.matchedTerm}”</span>
          </span>
        ))}
      </div>
      <p style={{ fontSize: 10, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
        Ditandai dari daftar bahan — bukan jaminan. Label bisa tak lengkap / ada kontaminasi silang; cek kemasan langsung.
      </p>
    </div>
  );
}

function VerdictView({
  input, verdict, allergens, context, usage, basis, onBasis, name, logged, saved, onLog, onSaveProduct,
}: {
  input: NutritionInput; verdict: NutritionVerdict; allergens: AllergenMatch[]; context: EaterContext;
  usage: { sugar: number; sodium: number; fat: number };
  basis: "package" | "serving"; onBasis: (b: "package" | "serving") => void;
  name: string; logged: boolean; saved: LocalSavedProduct[];
  onLog: () => Promise<void>; onSaveProduct: () => Promise<void>;
}) {
  const conditions = context.conditions;
  const budget = dailyBudget(conditions);
  const mult = basis === "package" ? input.servingsPerPack : 1;
  const s = input.serving;
  const impact = { sugar: (s.sugarG ?? 0) * mult, sodium: (s.sodiumMg ?? 0) * mult, fat: (s.totalFatG ?? 0) * mult };
  const bars: { key: "sugar" | "sodium" | "fat"; label: string; unit: string; primary: boolean }[] = [
    { key: "sugar", label: "Gula", unit: "g", primary: verdict.primaryNutrient === "sugar" },
    { key: "sodium", label: "Garam (natrium)", unit: "mg", primary: verdict.primaryNutrient === "sodium" },
    { key: "fat", label: "Lemak", unit: "g", primary: false },
  ];

  const [comparing, setComparing] = useState(false);
  const [compare, setCompare] = useState<{ name: string; verdict: NutritionVerdict } | null>(null);
  const others = saved.filter((p) => p.productName.toLowerCase() !== name.trim().toLowerCase());

  const pickCompare = (p: LocalSavedProduct) => {
    setCompare({ name: p.productName, verdict: computeVerdict(p.extracted as NutritionInput, conditions) });
    setComparing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {allergens.length > 0 && <AllergenAlert matches={allergens} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "12px 14px", borderLeft: `4px solid ${ZONE_COLOR[verdict.overall]}` }}>
        <span style={{ fontSize: 26 }}>{ZONE_EMOJI[verdict.overall]}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: "var(--ah-text-primary)" }}>{verdict.headline}</p>
          <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>
            {name}{name && !context.isSelf ? " · " : ""}{!context.isSelf && <span style={{ color: "var(--ah-cyan, #22D3EE)", fontWeight: 700 }}>untuk {context.name}</span>}
          </p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--ah-text-primary)", lineHeight: 1.5 }}>{verdict.reason}</p>
      <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>{verdict.suggestion}</p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Dampak dihitung:</span>
        <FormToggle value={basis} onChange={(v) => onBasis(v as "package" | "serving")}
          options={[["package", `Per kemasan (${input.servingsPerPack}×)`], ["serving", "Per sajian"]]} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={sectionLabel}>Anggaran GGL harian {conditions.includes("hypertension") && <span style={{ color: "var(--ah-score-fair)" }}>· natrium lebih ketat</span>}</p>
        {bars.map((b) => (
          <BudgetBar key={b.key} label={b.label} unit={b.unit} primary={b.primary} used={usage[b.key]} impact={impact[b.key]} budget={budget[b.key]} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {verdict.perNutrient.map((p) => (
          <span key={p.nutrient} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--ah-text-primary)", background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-full)", padding: "5px 10px" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ZONE_COLOR[p.zone] }} />
            {NUTRIENT_LABEL[p.nutrient]} {Math.round(p.per100)}<span style={{ color: "var(--ah-text-tertiary)", fontWeight: 500 }}>/100{input.foodForm === "beverage" ? "ml" : "g"}</span>
          </span>
        ))}
      </div>

      {verdict.flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {verdict.flags.map((f, i) => (<p key={i} style={{ fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>{f}</p>))}
        </div>
      )}

      {/* Pindai Pembanding */}
      {compare && <ComparePanel a={{ name: name || "Produk ini", verdict }} b={compare} conditions={conditions} onClose={() => setCompare(null)} />}
      {comparing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: 10 }}>
          <p style={{ fontSize: 11, color: "var(--ah-text-secondary)" }}>Pilih produk dari lemari untuk dibandingkan:</p>
          {others.map((p) => (
            <button key={p.id} onClick={() => pickCompare(p)} style={{ ...ghostBtn, textAlign: "left", justifyContent: "flex-start" }}>
              {ZONE_EMOJI[(p.lastVerdict as NutritionVerdict | null)?.overall ?? "green"]} {p.productName}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void onLog()} style={{ ...primaryBtn, flex: 1 }}>{logged ? "✓ Tercatat" : "Catat ke Food Diary"}</button>
        <button onClick={() => void onSaveProduct()} style={secondaryBtn}>Simpan Produk</button>
      </div>
      <button
        onClick={() => { if (others.length === 0) return; setComparing((v) => !v); setCompare(null); }}
        disabled={others.length === 0}
        style={{ ...ghostBtn, opacity: others.length === 0 ? 0.5 : 1 }}
        title={others.length === 0 ? "Simpan produk lain dulu untuk membandingkan" : undefined}
      >
        ⚖️ Pindai Pembanding{others.length === 0 ? " (simpan produk lain dulu)" : ""}
      </button>
    </div>
  );
}

function ComparePanel({ a, b, conditions, onClose }: {
  a: { name: string; verdict: NutritionVerdict }; b: { name: string; verdict: NutritionVerdict };
  conditions: NutritionCondition[]; onClose: () => void;
}) {
  const rows: { key: "sugar" | "sodium" | "fat"; label: string }[] = [
    { key: "sugar", label: "Gula" }, { key: "sodium", label: "Garam" }, { key: "fat", label: "Lemak" },
  ];
  const rank = { green: 0, yellow: 1, red: 2 } as const;
  const lighter = rank[a.verdict.overall] === rank[b.verdict.overall]
    ? null : rank[a.verdict.overall] < rank[b.verdict.overall] ? a : b;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={sectionLabel}>Perbandingan (per kemasan)</span>
        <button onClick={onClose} style={{ ...ghostBtn, minHeight: 26 }}>Tutup</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[a, b].map((x, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--ah-surface-1)", borderRadius: "var(--ah-r-inner)", padding: "8px 10px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)" }}>{ZONE_EMOJI[x.verdict.overall]} {x.name}</p>
            {rows.map((r) => {
              const mine = x.verdict.budgetImpact[r.key];
              const other = (x === a ? b : a).verdict.budgetImpact[r.key];
              const win = mine < other;
              return (
                <p key={r.key} style={{ fontSize: 11, color: win ? "var(--ah-score-excellent)" : "var(--ah-text-secondary)", fontWeight: win ? 700 : 500, fontVariantNumeric: "tabular-nums" }}>
                  {r.label} {mine}%{win ? " · lebih ringan" : ""}
                </p>
              );
            })}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--ah-text-primary)", lineHeight: 1.5 }}>
        {lighter ? `${ZONE_EMOJI[lighter.verdict.overall]} ${lighter.name} tergolong lebih ringan secara keseluruhan.`
          : "Keduanya setara secara keseluruhan — lihat rincian per nutrien di atas."}
      </p>
    </div>
  );
}

function Lemari({ products, onLoad, onRemove }: {
  products: LocalSavedProduct[]; onLoad: (p: LocalSavedProduct) => void; onRemove: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: 10 }}>
      <p style={sectionLabel}>🗄️ Lemari produk</p>
      {products.map((p) => {
        const v = p.lastVerdict as NutritionVerdict | null;
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <button onClick={() => onLoad(p)} style={{ ...ghostBtn, flex: 1, textAlign: "left", justifyContent: "flex-start" }}>
              {ZONE_EMOJI[v?.overall ?? "green"]} {p.productName} {p.scanCount > 1 && <span style={{ color: "var(--ah-text-tertiary)", fontWeight: 500 }}>· {p.scanCount}×</span>}
            </button>
            <button onClick={() => onRemove(p.id)} aria-label={`Hapus ${p.productName}`} style={{ ...ghostBtn, minHeight: 28, color: "var(--ah-text-tertiary)" }}>Hapus</button>
          </div>
        );
      })}
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
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          style={{
            minHeight: 30, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer",
            background: value === v ? "var(--ah-gradient-hero)" : "transparent",
            color: value === v ? "#fff" : "var(--ah-text-secondary)", fontSize: 11, fontWeight: 700,
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, unit, value, warn, onChange }: {
  label: string; unit: string; value: string; warn?: boolean; onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: warn ? "var(--ah-score-fair)" : "var(--ah-text-tertiary)" }}>
        {label} <span style={{ opacity: 0.6 }}>({unit})</span>{warn && " · periksa"}
      </span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="0"
        style={{ ...input, border: warn ? "1.5px solid var(--ah-score-fair)" : input.border }}
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
const scanNote: React.CSSProperties = {
  fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.5,
  background: "rgba(251,191,36,0.12)", borderRadius: "var(--ah-r-inner)", padding: "8px 10px",
};
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
  display: "inline-flex", alignItems: "center", gap: 6,
};
