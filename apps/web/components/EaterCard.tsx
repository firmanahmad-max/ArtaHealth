"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import { ALLERGEN_DEFS } from "@arta/core";
import type { AllergenEntry } from "@/lib/db";
import { eaters, addEater, removeEater } from "@/lib/eaters";

/**
 * Anggota Keluarga (Fase 4 · NG-4b). Persona gizi ringan untuk "Pindai untuk siapa"
 * di kartu Sadar Gizi — nama + relasi + kondisi (anggaran/nutrien utama) + alergen
 * (deteksi bahan). Milik profil pemilik; "Saya" tetap pakai profil kesehatan akun.
 * ⚠️ Di balik flag NEXT_PUBLIC_FEATURE_NUTRITION.
 */

const CONDITION_OPTS: [string, string][] = [
  ["hypertension", "Hipertensi"], ["diabetes", "Diabetes"], ["dyslipidemia", "Kolesterol"], ["gout", "Asam Urat"],
];
const RELATION_OPTS: [string, string][] = [
  ["anak", "Anak"], ["orang_tua", "Orang tua"], ["pasangan", "Pasangan"], ["lainnya", "Lainnya"],
];

export function EaterCard() {
  const { show } = useToast();
  const list = useLiveQuery(() => eaters(), []) ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("anak");
  const [conds, setConds] = useState<Set<string>>(new Set());
  const [allergs, setAllergs] = useState<Set<string>>(new Set());

  const resetForm = () => { setName(""); setRelation("anak"); setConds(new Set()); setAllergs(new Set()); setAdding(false); };
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, k: string) =>
    set((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const save = async () => {
    if (!name.trim()) { show({ variant: "info", message: "Beri nama anggota dulu." }); return; }
    const allergens: AllergenEntry[] = [...allergs].map((key) => ({ key }));
    await addEater({ name, relation, conditions: [...conds], allergens });
    resetForm();
    show({ message: `${name.trim()} ditambahkan` });
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>👨‍👩‍👧 Anggota Keluarga</p>
          <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>Pindai produk yang dipersonalisasi untuk mereka.</p>
        </div>
        <button onClick={() => setAdding((v) => !v)} style={ghostBtn}>{adding ? "Tutup" : "+ orang"}</button>
      </div>

      {list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "8px 12px" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>
                  {e.name} {e.relation && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ah-text-tertiary)" }}>· {RELATION_OPTS.find((r) => r[0] === e.relation)?.[1] ?? e.relation}</span>}
                </p>
                <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>
                  {e.conditions.length ? `${e.conditions.length} kondisi` : "tanpa kondisi"} · {e.allergens.length ? `${e.allergens.length} alergen` : "tanpa alergen"}
                </p>
              </div>
              <button onClick={() => void removeEater(e.id)} aria-label={`Hapus ${e.name}`} style={delBtn}>Hapus</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama (mis. Adik)" style={input} />
          <div>
            <p style={miniLabel}>Relasi</p>
            <ChipRow opts={RELATION_OPTS} active={new Set([relation])} onToggle={(k) => setRelation(k)} single />
          </div>
          <div>
            <p style={miniLabel}>Kondisi dipantau</p>
            <ChipRow opts={CONDITION_OPTS} active={conds} onToggle={(k) => toggle(setConds, k)} />
          </div>
          <div>
            <p style={miniLabel}>Alergi</p>
            <ChipRow opts={ALLERGEN_DEFS.map((d) => [d.key, `${d.icon} ${d.label}`])} active={allergs} onToggle={(k) => toggle(setAllergs, k)} />
          </div>
          <button onClick={() => void save()} style={primaryBtn}>Simpan anggota</button>
        </div>
      )}
    </div>
  );
}

function ChipRow({ opts, active, onToggle, single }: {
  opts: [string, string][]; active: Set<string>; onToggle: (k: string) => void; single?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
      {opts.map(([k, label]) => {
        const on = active.has(k);
        return (
          <button
            key={k} onClick={() => onToggle(k)} aria-pressed={on}
            style={{
              minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
              border: on ? `1.5px solid ${single ? "var(--ah-cyan, #22D3EE)" : "var(--ah-score-low)"}` : "1px solid var(--ah-border)",
              background: on ? (single ? "rgba(34,211,238,0.14)" : "rgba(248,113,113,0.14)") : "var(--ah-surface-1)",
              color: "var(--ah-text-primary)", fontSize: 12, fontWeight: 700,
            }}
          >
            {label}{on && !single ? " ✓" : ""}
          </button>
        );
      })}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const miniLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)" };
const input: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 14, width: "100%",
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const delBtn: React.CSSProperties = {
  minHeight: 28, padding: "0 10px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-tertiary)", fontSize: 11, fontWeight: 600, cursor: "pointer",
};
