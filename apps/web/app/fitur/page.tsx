"use client";
import { useState, type ReactNode } from "react";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { AppNav } from "@/components/AppNav";
import { DashboardSection } from "@/components/DashboardSection";
import { RiskPanelCard } from "@/components/RiskPanelCard";
import { EarlyWarningCard } from "@/components/EarlyWarningCard";
import { MonthlyInsightCard } from "@/components/MonthlyInsightCard";
import { WhatIfCard } from "@/components/WhatIfCard";
import { PulseCheckCard } from "@/components/PulseCheckCard";
import { CycleCard } from "@/components/CycleCard";
import { ImmunizationCard } from "@/components/ImmunizationCard";
import { VaultCard } from "@/components/VaultCard";
import { MedicationCard } from "@/components/MedicationCard";
import { AllergyCard } from "@/components/AllergyCard";
import { EaterCard } from "@/components/EaterCard";
import { NutritionScanCard } from "@/components/NutritionScanCard";
import { FoodDiaryCard } from "@/components/FoodDiaryCard";
import { MenuPlannerCard } from "@/components/MenuPlannerCard";
import { ConsultationReportCard } from "@/components/ConsultationReportCard";
import { ClaimCheckCard } from "@/components/ClaimCheckCard";
import { RadarSehatCard } from "@/components/RadarSehatCard";
import { WearableCard } from "@/components/WearableCard";
import { SatuSehatCard } from "@/components/SatuSehatCard";
import { FamilyCard } from "@/components/FamilyCard";
import { GamificationCard } from "@/components/GamificationCard";
import {
  featureBiomarker, featureEarlyWarning, featureMonthlyInsight, featureWhatIf, featureRppg,
  featureCycle, featureImmunization, featureVault, featureMedication, featureNutrition,
  featureFoodDiary, featureConsultation, featureCekKlaim, featureRadar, featureWearable,
  featureSatuSehat, featureFamily, featureGamification,
} from "@/lib/features";

/**
 * Halaman "Fitur" (Fase 8 · lanjutan KR-3) — rumah semua kartu fitur yang dulu menumpuk di
 * Beranda. Beranda kini hanya loop harian; mencari fitur = tab ini. Grid peluncur di atas
 * melompat ke kartunya (ikon + label = judul kartu). Kondisi flag & isi kartu TIDAK berubah —
 * hanya pindah lokasi. Non-medis.
 */

interface Feature {
  key: string;
  icon: string;
  label: string;
  on: () => boolean;
  node: (onLog: () => void) => ReactNode;
}

const KESEHATAN: Feature[] = [
  { key: "risk", icon: "🩺", label: "Panel Risiko", on: featureBiomarker, node: (onLog) => <RiskPanelCard onLog={onLog} /> },
  { key: "ew", icon: "🔭", label: "Deteksi Dini", on: featureEarlyWarning, node: () => <EarlyWarningCard /> },
  { key: "monthly", icon: "📅", label: "Laporan Bulanan", on: featureMonthlyInsight, node: (onLog) => <MonthlyInsightCard onLog={onLog} /> },
  { key: "whatif", icon: "🔮", label: "Bagaimana Jika", on: featureWhatIf, node: (onLog) => <WhatIfCard onLog={onLog} /> },
  { key: "rppg", icon: "❤️", label: "Cek Nadi", on: featureRppg, node: () => <PulseCheckCard /> },
  { key: "cycle", icon: "🌸", label: "Kesehatan Siklus", on: featureCycle, node: () => <CycleCard /> },
  { key: "imm", icon: "💉", label: "Imunisasi Anak", on: featureImmunization, node: () => <ImmunizationCard /> },
  { key: "vault", icon: "🗂️", label: "Vault Lab", on: featureVault, node: () => <VaultCard /> },
  { key: "med", icon: "💊", label: "Obat & Jadwal", on: featureMedication, node: () => <MedicationCard /> },
  { key: "allergy", icon: "🚨", label: "Alergi Saya", on: featureNutrition, node: () => <AllergyCard /> },
  { key: "eater", icon: "👨‍👩‍👧", label: "Anggota Keluarga", on: featureNutrition, node: () => <EaterCard /> },
  { key: "nutriscan", icon: "🥗", label: "Sadar Gizi", on: featureNutrition, node: () => <NutritionScanCard /> },
  { key: "food", icon: "🍽️", label: "Catat Makan", on: featureFoodDiary, node: () => <FoodDiaryCard /> },
  { key: "menu", icon: "🍱", label: "Perencana Menu", on: featureFoodDiary, node: () => <MenuPlannerCard /> },
  { key: "consult", icon: "🩻", label: "Mode Konsultasi", on: featureConsultation, node: () => <ConsultationReportCard /> },
  { key: "claim", icon: "🔎", label: "Cek Klaim", on: featureCekKlaim, node: () => <ClaimCheckCard /> },
];

const ALAT: Feature[] = [
  { key: "radar", icon: "🌫️", label: "Radar Sehat", on: featureRadar, node: () => <RadarSehatCard /> },
  { key: "wearable", icon: "⌚", label: "Wearable", on: featureWearable, node: () => <WearableCard /> },
  { key: "satusehat", icon: "🔗", label: "SATUSEHAT", on: featureSatuSehat, node: () => <SatuSehatCard /> },
  { key: "family", icon: "👪", label: "Keluarga", on: featureFamily, node: () => <FamilyCard /> },
  { key: "gami", icon: "🎮", label: "Petualangan", on: featureGamification, node: () => <GamificationCard /> },
];

export default function FiturPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const onLog = () => setSheetOpen(true);

  const kesehatan = KESEHATAN.filter((f) => f.on());
  const alat = ALAT.filter((f) => f.on());
  const all = [...kesehatan, ...alat];

  const jumpTo = (key: string) =>
    document.getElementById(`f-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <main style={{ maxWidth: 400, margin: "0 auto", padding: "16px 16px 96px", display: "flex", flexDirection: "column", gap: 12 }}>
        <header>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Fitur</h1>
          <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>Semua alat kesehatanmu di satu tempat</p>
        </header>

        {all.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
            Belum ada fitur tambahan yang aktif. Fitur baru akan muncul di sini.
          </p>
        ) : (
          <>
            {/* Grid peluncur: lompat cepat ke kartu tanpa scroll panjang */}
            <nav aria-label="Pintasan fitur" style={grid}>
              {all.map((f) => (
                <button key={f.key} onClick={() => jumpTo(f.key)} style={tile}>
                  <span aria-hidden style={{ fontSize: 20, lineHeight: 1.2 }}>{f.icon}</span>
                  <span style={tileLabel}>{f.label}</span>
                </button>
              ))}
            </nav>

            {kesehatan.length > 0 && (
              <DashboardSection title="Kesehatan" count={kesehatan.length}>
                {kesehatan.map((f) => (
                  <div key={f.key} id={`f-${f.key}`} style={{ scrollMarginTop: 12 }}>{f.node(onLog)}</div>
                ))}
              </DashboardSection>
            )}

            {alat.length > 0 && (
              <DashboardSection title="Alat & Data" count={alat.length}>
                {alat.map((f) => (
                  <div key={f.key} id={`f-${f.key}`} style={{ scrollMarginTop: 12 }}>{f.node(onLog)}</div>
                ))}
              </DashboardSection>
            )}
          </>
        )}
      </main>

      <QuickLogSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <AppNav activeKey="fitur" onLog={onLog} />
    </>
  );
}

const grid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
};
const tile: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
  gap: 4, minHeight: 64, padding: "8px 2px", cursor: "pointer",
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)",
};
const tileLabel: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 600, color: "var(--ah-text-secondary)", lineHeight: 1.25,
  textAlign: "center", overflowWrap: "break-word", maxWidth: "100%",
};
