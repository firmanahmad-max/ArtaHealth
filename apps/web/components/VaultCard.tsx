"use client";
import { useRef, useState } from "react";
import { useToast } from "@arta/design-system";
import {
  extractedLabSchema, resolveLabValues, classifyBiomarker, DEFAULT_BIOMARKER_BANDS,
  type LabFinding, type Zone, type Sex,
} from "@arta/core";
import { scanLab, saveLabFindings } from "@/lib/vault";

/**
 * Medical Vault OCR (Fase 6 · MV-3). Foto hasil lab (vision OCR) atau isi manual →
 * nilai diklasifikasi DETERMINISTIK (engine biomarker Fase 2) → konfirmasi user
 * ("N nilai ditemukan — tambahkan?") → biomarker_readings source='vault_ocr'.
 * Riwayat lab jadi trend dalam satu menit. Di balik flag NEXT_PUBLIC_FEATURE_VAULT.
 * ⚠️ Butuh migration 0022 db-push + deploy vault-scan sebelum flag nyala.
 */

const ZONE_COLOR: Record<Zone, string> = {
  green: "var(--ah-score-excellent)", yellow: "var(--ah-score-fair)",
  orange: "#FB923C", red: "var(--ah-score-low)",
};

type Form = {
  gdp: string; gds: string; pp2: string; hba1c: string;
  total_chol: string; ldl: string; hdl: string; tg: string;
  uric_acid: string; docDate: string;
};
const EMPTY: Form = { gdp: "", gds: "", pp2: "", hba1c: "", total_chol: "", ldl: "", hdl: "", tg: "", uric_acid: "", docDate: "" };
const num = (s: string): number | undefined => { const v = parseFloat(s.replace(",", ".")); return Number.isFinite(v) ? v : undefined; };
const pick = (o: Record<string, number | undefined>) => (Object.values(o).some((v) => v !== undefined) ? o : undefined);

export function VaultCard() {
  const { show } = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [sex, setSex] = useState<Sex>("male");
  const [findings, setFindings] = useState<LabFinding[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const buildExtracted = () => ({
    test_date: form.docDate || undefined,
    glucose: pick({ gdp: num(form.gdp), gds: num(form.gds), pp2: num(form.pp2), hba1c: num(form.hba1c) }),
    lipid: pick({ total_chol: num(form.total_chol), ldl: num(form.ldl), hdl: num(form.hdl), tg: num(form.tg) }),
    uric_acid: num(form.uric_acid),
  });

  const readValues = (extractedRaw: unknown) => {
    const parsed = extractedLabSchema.safeParse(extractedRaw);
    if (!parsed.success) { show({ variant: "info", message: "Isi minimal satu nilai lab." }); return; }
    const f = resolveLabValues(parsed.data, { sex });
    if (f.length === 0) { show({ variant: "info", message: "Isi minimal satu nilai lab (mis. GDP, HbA1c)." }); return; }
    setFindings(f);
    setChosen(new Set(f.map((_, i) => i)));   // default semua dipilih
    setScanMsg(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true); setScanMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await scanLab(String(reader.result));
      setScanning(false);
      if (!res.ok) { setScanMsg(res.message); return; }
      readValues(res.extracted);
      setScanMsg(res.sanity.length ? `Terbaca dari foto. Periksa: ${res.sanity.map((s) => s.field).join(", ")}.` : "Terbaca dari foto — cek nilainya, lalu tambahkan.");
    };
    reader.readAsDataURL(file);
  };

  const toggle = (i: number) => setChosen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const save = async () => {
    if (!findings) return;
    const selected = findings.filter((_, i) => chosen.has(i));
    if (selected.length === 0) { show({ variant: "info", message: "Pilih minimal satu nilai." }); return; }
    const n = await saveLabFindings(selected, { extracted: buildExtracted(), docDate: form.docDate || null, sex });
    show({ message: `${n} nilai ditambahkan ke pemantauan` });
    setForm(EMPTY); setFindings(null); setChosen(new Set()); setScanMsg(null);
  };

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🗂️ Vault Lab</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>Foto atau isi hasil lab → masuk pemantauan biomarker.</p>
      </div>

      {!findings ? (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} disabled={scanning} style={{ ...secondaryBtn, opacity: scanning ? 0.6 : 1 }}>
            {scanning ? "Membaca…" : "📄 Pindai hasil lab"}
          </button>
          {scanMsg && <p style={scanNote}>{scanMsg}</p>}

          <p style={sectionLabel}>Atau isi manual (yang ada saja)</p>
          <div style={grid2}>
            <Field label="Glukosa puasa (GDP)" unit="mg/dL" value={form.gdp} onChange={(v) => set("gdp", v)} />
            <Field label="Glukosa sewaktu" unit="mg/dL" value={form.gds} onChange={(v) => set("gds", v)} />
            <Field label="Glukosa 2 jam PP" unit="mg/dL" value={form.pp2} onChange={(v) => set("pp2", v)} />
            <Field label="HbA1c" unit="%" value={form.hba1c} onChange={(v) => set("hba1c", v)} />
            <Field label="Kolesterol total" unit="mg/dL" value={form.total_chol} onChange={(v) => set("total_chol", v)} />
            <Field label="LDL" unit="mg/dL" value={form.ldl} onChange={(v) => set("ldl", v)} />
            <Field label="HDL" unit="mg/dL" value={form.hdl} onChange={(v) => set("hdl", v)} />
            <Field label="Trigliserida" unit="mg/dL" value={form.tg} onChange={(v) => set("tg", v)} />
            <Field label="Asam urat" unit="mg/dL" value={form.uric_acid} onChange={(v) => set("uric_acid", v)} />
            <Field label="Tanggal lab" unit="opsional" value={form.docDate} onChange={(v) => set("docDate", v)} type="date" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Jenis kelamin (asam urat):</span>
            <FormToggle value={sex} onChange={(v) => setSex(v as Sex)} options={[["male", "Pria"], ["female", "Wanita"]]} />
          </div>
          <button onClick={() => readValues(buildExtracted())} style={primaryBtn}>Baca nilai</button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>Kami menemukan {findings.length} nilai — tambahkan?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {findings.map((f, i) => {
              const cls = classifyBiomarker(f.input, DEFAULT_BIOMARKER_BANDS);
              const on = chosen.has(i);
              return (
                <button key={i} onClick={() => toggle(i)} aria-pressed={on} style={{ ...row, borderColor: on ? "var(--ah-cyan, #22D3EE)" : "var(--ah-border)", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 16 }}>{on ? "☑️" : "⬜"}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>{f.label}</p>
                    <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>{f.summary}</p>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--ah-text-primary)" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: ZONE_COLOR[cls.zone] }} />
                    {cls.band.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => void save()} style={{ ...primaryBtn, flex: 1 }}>Tambahkan {chosen.size} ke pemantauan</button>
            <button onClick={() => { setFindings(null); setChosen(new Set()); }} style={secondaryBtn}>Batal</button>
          </div>
        </>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Nilai lab masuk ke Panel Risiko sebagai riwayat. Klasifikasi = rentang laboratorium; diagnosis tetap oleh dokter.
      </p>
    </div>
  );
}

function Field({ label, unit, value, onChange, type }: {
  label: string; unit: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>{label} <span style={{ opacity: 0.6 }}>({unit})</span></span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={type === "date" ? undefined : "decimal"} type={type} placeholder={type === "date" ? undefined : "—"} style={input} />
    </label>
  );
}

function FormToggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div style={{ display: "inline-flex", gap: 4, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-full)", padding: 3 }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          style={{ minHeight: 30, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer", background: value === v ? "var(--ah-gradient-hero)" : "transparent", color: value === v ? "#fff" : "var(--ah-text-secondary)", fontSize: 11, fontWeight: 700 }}>
          {label}
        </button>
      ))}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, background: "var(--ah-surface-2)",
  border: "1.5px solid var(--ah-border)", borderRadius: "var(--ah-r-inner)", padding: "8px 12px",
};
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
const scanNote: React.CSSProperties = {
  fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.5,
  background: "rgba(251,191,36,0.12)", borderRadius: "var(--ah-r-inner)", padding: "8px 10px",
};
