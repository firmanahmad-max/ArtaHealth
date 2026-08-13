"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import { fastingScheduleConflicts, parseTimeToMinutes, type PrayerTimes } from "@arta/core";
import { db, type LocalMedication } from "@/lib/db";
import {
  activeMedications, addMedication, removeMedication, setIntake, doseScheduledAt,
} from "@/lib/medication";
import { prayerTimesFor, isFastingToday } from "@/lib/fasting";
import { featureRamadan } from "@/lib/features";

/**
 * Medicine Reminder (Fase 3). Daftar obat + jadwal (diisi user), tandai minum,
 * dan DETEKSI KONFLIK jadwal obat vs jam puasa (addendum-ramadan §3.3 baris 2):
 * bila dosis jatuh di jam puasa → arahkan diskusi ke dokter/apoteker. Aplikasi
 * TIDAK PERNAH menyarankan waktu/dosis baru (CONTEXT §4).
 * ⚠️ Teks konflik dari spec §3.3 — menunggu review; fitur di balik feature flag.
 */
export function MedicationCard() {
  const { show } = useToast();
  const meds = useLiveQuery(() => activeMedications(), []);
  const fasting = useLiveQuery(() => isFastingToday(), []) ?? false;
  const times = useLiveQuery<PrayerTimes | null>(
    () => (fasting && featureRamadan() ? prayerTimesFor() : Promise.resolve(null)),
    [fasting],
  );
  const intakeMap = useLiveQuery(async () => {
    const all = await db.medication_intakes.toArray();
    const map = new Map<string, string>();
    for (const i of all) if (!i.deletedAt) map.set(`${i.medicationId}|${i.scheduledAt}`, i.status);
    return map;
  }, []);

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [timesStr, setTimesStr] = useState("");
  const [adding, setAdding] = useState(false);

  if (!meds || !intakeMap) return null;

  const save = async () => {
    const parsed = timesStr.split(",").map((t) => t.trim()).filter((t) => parseTimeToMinutes(t) !== null);
    if (!name.trim() || parsed.length === 0) {
      show({ variant: "info", message: "Isi nama & minimal satu waktu (mis. 08:00, 20:00)." });
      return;
    }
    await addMedication(name, parsed, { dosage: dosage || undefined });
    setName(""); setDosage(""); setTimesStr(""); setAdding(false);
    show({ message: "Obat ditambahkan" });
  };

  const toggleDose = async (med: LocalMedication, t: string) => {
    const at = doseScheduledAt(t);
    const taken = intakeMap.get(`${med.id}|${at}`) === "taken";
    await setIntake(med.id, at, taken ? "pending" : "taken");
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>💊 Obat &amp; Jadwal</p>
        <button onClick={() => setAdding((v) => !v)} style={addBtn}>{adding ? "Tutup" : "+ Obat"}</button>
      </div>

      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama obat (mis. Amlodipin)" style={input} />
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosis (opsional, mis. 5 mg)" style={input} />
          <input value={timesStr} onChange={(e) => setTimesStr(e.target.value)} placeholder="Jam minum, pisah koma: 08:00, 20:00" style={input} />
          <button onClick={() => void save()} style={primaryBtn}>Simpan</button>
        </div>
      )}

      {meds.length === 0 && !adding && (
        <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
          Catat obat rutin Anda untuk pengingat & pemantauan minum.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {meds.map((med) => {
          const conflicts = times ? fastingScheduleConflicts(med.schedule.times, times.imsak, times.maghrib) : [];
          return (
            <div key={med.id} style={row}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>
                    {med.name} {med.dosage && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ah-text-tertiary)" }}>· {med.dosage}</span>}
                  </p>
                </div>
                <button onClick={() => void removeMedication(med.id)} aria-label={`Hapus ${med.name}`} style={delBtn}>Hapus</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {med.schedule.times.map((t) => {
                  const taken = intakeMap.get(`${med.id}|${doseScheduledAt(t)}`) === "taken";
                  const clash = conflicts.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => void toggleDose(med, t)}
                      aria-pressed={taken}
                      style={{
                        minHeight: 30, padding: "0 10px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
                        border: taken ? "1.5px solid var(--ah-score-excellent)" : clash ? "1.5px solid var(--ah-score-low)" : "1px solid var(--ah-border)",
                        background: taken ? "var(--ah-score-excellent)" : "var(--ah-surface-1)",
                        color: taken ? "#0A0E1A" : "var(--ah-text-primary)", fontSize: 12, fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {taken ? "✓ " : clash ? "⚠️ " : ""}{t}
                    </button>
                  );
                })}
              </div>
              {conflicts.length > 0 && (
                <p style={conflictNote}>
                  ⚠️ Jadwal obat {conflicts.join(", ")} jatuh di jam puasa. Diskusikan penyesuaian dengan dokter/apoteker, lalu perbarui jadwalnya di sini.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const row: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8,
  background: "var(--ah-surface-2)", borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
};
const addBtn: React.CSSProperties = {
  minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const delBtn: React.CSSProperties = {
  minHeight: 28, padding: "0 10px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-tertiary)", fontSize: 11, fontWeight: 600, cursor: "pointer",
};
const input: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const conflictNote: React.CSSProperties = {
  fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.5,
  background: "rgba(248,113,113,0.12)", borderRadius: "var(--ah-r-inner)", padding: "8px 10px",
};
