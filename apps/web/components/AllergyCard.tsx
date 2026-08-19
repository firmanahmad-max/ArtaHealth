"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import { ALLERGEN_DEFS } from "@arta/core";
import {
  selectedAllergens, getAllergyCard, toggleAllergen, addCustomAllergen, removeAllergen, setAllergyNotes,
} from "@/lib/allergy";

/**
 * Kartu Alergi (Fase 4 · NG-4). Pengguna memilih alergen yang dipantau (Big-9 +
 * kustom) → jadi basis deteksi pada daftar bahan hasil pindai. Menyimpan catatan
 * darurat opsional. Bahasa menegaskan app MENANDAI kemungkinan, bukan menjamin aman.
 * ⚠️ Daftar & teks menunggu review ahli gizi/alergi; di balik flag.
 */
export function AllergyCard() {
  const { show } = useToast();
  const selected = useLiveQuery(() => selectedAllergens(), []) ?? [];
  const card = useLiveQuery(() => getAllergyCard(), []);
  const [custom, setCustom] = useState("");
  const [notes, setNotes] = useState<string | null>(null);

  const selectedKeys = new Set(selected.map((a) => a.key));
  const customOnes = selected.filter((a) => a.custom);
  const notesValue = notes ?? card?.notes ?? "";

  const addCustom = async () => {
    if (!custom.trim()) return;
    await addCustomAllergen(custom);
    setCustom("");
    show({ message: "Alergen ditambahkan" });
  };

  return (
    <div style={card_}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🚨 Alergi Saya</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Pilih yang ingin ditandai saat memindai label.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ALLERGEN_DEFS.map((d) => {
          const on = selectedKeys.has(d.key);
          return (
            <button
              key={d.key}
              onClick={() => void toggleAllergen(d.key, !on)}
              aria-pressed={on}
              style={{
                minHeight: 34, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
                border: on ? "1.5px solid var(--ah-score-low)" : "1px solid var(--ah-border)",
                background: on ? "rgba(248,113,113,0.14)" : "var(--ah-surface-2)",
                color: "var(--ah-text-primary)", fontSize: 12, fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              {d.icon} {d.label}{on ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      {customOnes.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {customOnes.map((a) => (
            <span key={a.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)", background: "rgba(248,113,113,0.14)", border: "1.5px solid var(--ah-score-low)", borderRadius: "var(--ah-r-full)", padding: "5px 10px" }}>
              ⚠️ {a.label}
              <button onClick={() => void removeAllergen(a.key)} aria-label={`Hapus ${a.label}`} style={{ border: "none", background: "transparent", color: "var(--ah-text-tertiary)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void addCustom(); }}
          placeholder="Alergen lain (mis. MSG, cokelat)" style={input}
        />
        <button onClick={() => void addCustom()} style={addBtn}>Tambah</button>
      </div>

      <textarea
        value={notesValue}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => { if (notes !== null) void setAllergyNotes(notes); }}
        placeholder="Catatan darurat (opsional) — mis. reaksi berat, bawa epinephrine"
        rows={2}
        style={{ ...input, minHeight: 56, padding: "10px 12px", resize: "vertical", lineHeight: 1.5 }}
      />

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Kami menandai <strong>kemungkinan</strong> kandungan dari daftar bahan — bukan jaminan bebas alergen.
        Label bisa tak lengkap atau ada kontaminasi silang. Untuk alergi berat, selalu cek kemasan langsung.
      </p>
    </div>
  );
}

const card_: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const input: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 14, width: "100%",
};
const addBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
