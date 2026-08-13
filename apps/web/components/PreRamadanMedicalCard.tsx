"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import { PRE_RAMADAN_MEDICAL } from "@arta/core";
import { getFastingSettings, isFastingToday, acknowledgeMedical } from "@/lib/fasting";
import { monitoredSet } from "@/lib/conditions";

/**
 * Interstitial keamanan medis pra-Ramadan (addendum-ramadan §3.3 baris 1) —
 * sinergi Silent Killer Guard. Muncul SATU KALI bila pengguna berpuasa DAN
 * memantau diabetes/hipertensi, mengarahkan konsultasi dokter (bukan menghakimi,
 * bukan melarang). ⚠️ Teks dari @arta/core menunggu review medis (§10).
 */
export function PreRamadanMedicalCard() {
  const { show } = useToast();
  const settings = useLiveQuery(() => getFastingSettings(), []);
  const monitored = useLiveQuery(() => monitoredSet(), []);
  const fasting = useLiveQuery(() => isFastingToday(), []);

  if (!settings || !monitored || fasting === undefined) return null;

  const hasChronic = monitored.has("diabetes") || monitored.has("hypertension");
  if (!fasting || !hasChronic || settings.medicalAckAt) return null;

  const ack = async () => {
    await acknowledgeMedical();
    show({ message: "Baik — jaga pemantauan Anda selama puasa 🌙" });
  };

  return (
    <div role="alert" style={card}>
      <p style={{ fontSize: 13, fontWeight: 800, color: "var(--ah-text-primary)" }}>🩺 {PRE_RAMADAN_MEDICAL.title}</p>
      <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>{PRE_RAMADAN_MEDICAL.body}</p>
      <button onClick={() => void ack()} style={btn}>{PRE_RAMADAN_MEDICAL.cta}</button>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(139,92,246,0.16), rgba(251,146,60,0.14))",
  border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-card)",
  padding: 14, display: "flex", flexDirection: "column", gap: 8,
};
const btn: React.CSSProperties = {
  minHeight: 40, borderRadius: "var(--ah-r-full)", border: "none", alignSelf: "flex-start",
  padding: "0 16px", background: "var(--ah-gradient-hero)", color: "#fff",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
};
