"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import {
  familyMembers, ensureSelf, addMember, removeMember, ageFromDob, RELATION_LABEL, type Relation,
} from "@/lib/family";

/**
 * Family Health / Caregiver (Fase 6 · FM-1). Roster anggota keluarga (kelola anggota).
 * Pendekatan aditif — bagian Family terpisah, tak mengubah profil aktif global.
 * Pemantauan kesehatan per-anggota (biomarker/gizi/dll) menyusul di FM-2.
 * Di balik flag NEXT_PUBLIC_FEATURE_FAMILY.
 */

const ADD_RELATIONS: Relation[] = ["father", "mother", "child", "elder", "other"];
const RELATION_ICON: Record<Relation, string> = {
  self: "🙂", father: "👨", mother: "👩", child: "🧒", elder: "🧓", other: "👤",
};

export function FamilyCard() {
  const { show } = useToast();
  useEffect(() => { void ensureSelf(); }, []);   // seed "Saya" (write) di luar liveQuery
  const members = useLiveQuery(() => familyMembers(), []) ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation>("child");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "">("");

  const reset = () => { setName(""); setRelation("child"); setDob(""); setSex(""); setAdding(false); };

  const save = async () => {
    if (!name.trim()) { show({ variant: "info", message: "Isi nama anggota dulu." }); return; }
    await addMember({ displayName: name, relation, dob: dob || null, sex: sex || null });
    reset();
    show({ message: `${name.trim()} ditambahkan ke keluarga` });
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>👪 Keluarga</p>
          <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>Kelola anggota untuk dipantau bersama.</p>
        </div>
        <button onClick={() => setAdding((v) => !v)} style={ghostBtn}>{adding ? "Tutup" : "+ Anggota"}</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {members.map((m) => {
          const age = ageFromDob(m.dob);
          return (
            <div key={m.id} style={row}>
              <span style={{ fontSize: 20 }}>{RELATION_ICON[m.relation]}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>
                  {m.displayName} {m.isSelf && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ah-cyan, #22D3EE)" }}>SAYA</span>}
                </p>
                <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>
                  {RELATION_LABEL[m.relation]}{age !== null ? ` · ${age} th` : ""}{m.sex ? ` · ${m.sex === "male" ? "Pria" : "Wanita"}` : ""}
                </p>
              </div>
              {!m.isSelf && (
                <button onClick={() => void removeMember(m.id)} aria-label={`Hapus ${m.displayName}`} style={delBtn}>Hapus</button>
              )}
            </div>
          );
        })}
      </div>

      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama anggota" style={input} />
          <div>
            <p style={miniLabel}>Hubungan</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {ADD_RELATIONS.map((r) => (
                <button key={r} onClick={() => setRelation(r)} aria-pressed={relation === r}
                  style={{
                    minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
                    border: relation === r ? "1.5px solid var(--ah-cyan, #22D3EE)" : "1px solid var(--ah-border)",
                    background: relation === r ? "rgba(34,211,238,0.14)" : "var(--ah-surface-1)",
                    color: "var(--ah-text-primary)", fontSize: 12, fontWeight: 700,
                  }}>
                  {RELATION_ICON[r]} {RELATION_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <div style={grid2}>
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={miniLabel}>Tanggal lahir (opsional)</span>
              <input value={dob} onChange={(e) => setDob(e.target.value)} type="date" style={input} />
            </label>
            <div>
              <p style={miniLabel}>Jenis kelamin</p>
              <div style={{ display: "inline-flex", gap: 4, background: "var(--ah-surface-1)", borderRadius: "var(--ah-r-full)", padding: 3, marginTop: 4 }}>
                {([["male", "Pria"], ["female", "Wanita"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setSex(sex === v ? "" : v)} aria-pressed={sex === v}
                    style={{ minHeight: 30, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer", background: sex === v ? "var(--ah-gradient-hero)" : "transparent", color: sex === v ? "#fff" : "var(--ah-text-secondary)", fontSize: 11, fontWeight: 700 }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => void save()} style={primaryBtn}>Simpan anggota</button>
        </div>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Pemantauan kesehatan tiap anggota (tensi/gula/lab, dll) menyusul — dengan izin anggota.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, background: "var(--ah-surface-2)",
  borderRadius: "var(--ah-r-inner)", padding: "8px 12px",
};
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "start" };
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
