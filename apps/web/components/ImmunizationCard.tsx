"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { summarizePlan, IMMUNIZATION_GUIDELINE, type ImmunizationEntry, type ImmunizationStatus } from "@arta/core";
import { childImmunizationPlan, setChildDob, toggleGiven } from "@/lib/immunization";
import { db } from "@/lib/db";

/**
 * Jadwal Imunisasi Anak (V3-6). Dari tanggal lahir → status tiap vaksin (jadwal IDAI,
 * deterministik). Tandai yang sudah diberikan (lokal). Non-medis — pemberian oleh nakes.
 * Flag NEXT_PUBLIC_FEATURE_IMMUNIZATION.
 */

const STATUS: Record<ImmunizationStatus, { label: string; color: string; bg: string; order: number }> = {
  overdue: { label: "Terlambat", color: "var(--ah-score-low)", bg: "rgba(248,113,113,0.14)", order: 0 },
  due: { label: "Jatuh tempo", color: "#FB923C", bg: "rgba(251,146,60,0.12)", order: 1 },
  upcoming: { label: "Akan datang", color: "var(--ah-text-tertiary)", bg: "var(--ah-surface-2)", order: 2 },
  given: { label: "Sudah", color: "var(--ah-score-excellent)", bg: "rgba(52,211,153,0.10)", order: 3 },
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export function ImmunizationCard() {
  const dobStored = useLiveQuery(async () => ((await db.meta.get("imm:dob"))?.value as string) ?? "", []);
  const data = useLiveQuery(() => childImmunizationPlan(), [dobStored]);

  const rows: ImmunizationEntry[] = data?.plan ?? [];
  const summary = rows.length ? summarizePlan(rows) : null;
  // urut: status prioritas lalu tanggal
  const sorted = [...rows].sort((a, b) => STATUS[a.status].order - STATUS[b.status].order || a.dueISO.localeCompare(b.dueISO));

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>💉 Imunisasi Anak</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Jadwal dari tanggal lahir. Mengikuti pedoman — pemberian & keputusan oleh tenaga kesehatan.
        </p>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={miniLabel}>Tanggal lahir anak</span>
        <input type="date" defaultValue={dobStored || ""} onChange={(e) => e.target.value && void setChildDob(new Date(e.target.value).toISOString())} style={input} />
      </label>

      {!data && dobStored === "" && (
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>Isi tanggal lahir untuk melihat jadwal imunisasi.</p>
      )}

      {summary && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["overdue", "due", "upcoming", "given"] as ImmunizationStatus[]).map((s) => (
              summary[s] > 0 ? (
                <span key={s} style={{ fontSize: 11, fontWeight: 700, color: STATUS[s].color, border: `1px solid ${STATUS[s].color}`, borderRadius: "var(--ah-r-full)", padding: "2px 9px" }}>
                  {summary[s]} {STATUS[s].label}
                </span>
              ) : null
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {sorted.map((e) => {
              const s = STATUS[e.status];
              return (
                <button key={e.key} onClick={() => void toggleGiven(e.key)} style={{ ...row, background: s.bg, border: `1px solid ${e.status === "given" ? "var(--ah-score-excellent)" : "var(--ah-border)"}` }}>
                  <span style={{ fontSize: 15 }}>{e.status === "given" ? "✅" : "⭕"}</span>
                  <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)", textDecoration: e.status === "given" ? "line-through" : "none" }}>{e.label}</p>
                    <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)" }}>{e.ageDueLabel} · {fmtDate(e.dueISO)}{e.note ? ` · ${e.note}` : ""}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: s.color, flexShrink: 0 }}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        {IMMUNIZATION_GUIDELINE}. Bukan pengganti nasihat tenaga kesehatan; jadwal riil bisa berbeda per anak.
      </p>
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
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, borderRadius: "var(--ah-r-inner)", padding: "8px 12px", cursor: "pointer", width: "100%",
};
