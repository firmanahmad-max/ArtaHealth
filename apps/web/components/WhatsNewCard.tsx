"use client";
import { useEffect, useState } from "react";
import { parseWhatsNewSeen, pendingWhatsNew, serializeWhatsNewSeen } from "@arta/core";
import {
  featureFocus, featureWearable, featureRadar, featureSatuSehat, featureQuickLog, featureNotifPrefs,
  featureRamadan, featureRamadanReadiness, featureRamadanMenu, featureFastingReport, featureRamadanWrapped,
} from "@/lib/features";

/**
 * "Apa Baru" (Fase 8 · KR-4) — kartu dismissible yang memperkenalkan fitur yang baru dinyalakan
 * ke pengguna lama. Hanya entri yang flag-nya aktif. Pelacakan PER ENTRI (@arta/core whats-new):
 * "Mengerti" menandai entri yang tampil sebagai sudah dilihat → menambah entri baru TIDAK
 * memunculkan ulang yang lama; entri > 3 bulan kedaluwarsa. Cukup tambahkan entri ber-`since`.
 * Non-medis.
 */

const KEY = "ah-whatsnew-seen";

interface Entry { id: string; since: string; icon: string; title: string; blurb: string; on: () => boolean }
const ENTRIES: Entry[] = [
  { id: "focus", since: "2026-09", icon: "🎯", title: "Fokus Hari Ini", blurb: "Ringkasan 1–3 hal penting untuk kamu lakukan hari ini.", on: featureFocus },
  { id: "wearable", since: "2026-09", icon: "⌚", title: "Impor data perangkat", blurb: "Bawa langkah, tidur & detak dari export Google Fit.", on: featureWearable },
  { id: "radar", since: "2026-09", icon: "🌫️", title: "Radar Sehat", blurb: "Pantau kualitas udara (AQI) di lokasimu.", on: featureRadar },
  { id: "satusehat", since: "2026-09", icon: "🔗", title: "Ekspor FHIR", blurb: "Kemas datamu ke berkas standar untuk dibawa ke faskes.", on: featureSatuSehat },
  { id: "quicklog", since: "2026-09", icon: "💬", title: "Catat lewat chat & suara", blurb: "Ketik atau ucapkan “minum 2 gelas” → langsung tercatat.", on: featureQuickLog },
  { id: "beranda", since: "2026-09", icon: "🧭", title: "Beranda lebih rapi", blurb: "Kartu dikelompokkan; alat sekunder bisa dilipat.", on: () => true },
  {
    id: "pengingat-pintar", since: "2026-11", icon: "🔔", title: "Pengingat lebih pintar",
    blurb: featureNotifPrefs()
      ? "Ringkasan tiap Minggu malam & kabar saat rentetanmu terancam. Pilih sendiri jenis pengingat di kartu Pengingat."
      : "Ringkasan tiap Minggu malam & kabar saat rentetanmu terancam — aktifkan di kartu Pengingat.",
    on: () => true,
  },
  {
    id: "tab-fitur", since: "2026-11", icon: "🧭", title: "Tab Fitur baru",
    blurb: "Semua alat kesehatan kini rapi di tab Fitur (kanan bawah) — Beranda jadi ringkas.",
    on: () => true,
  },
  // Musim Ramadan 2027 — muncul otomatis begitu flag musimannya dinyalakan.
  { id: "ramadan-readiness", since: "2027-02", icon: "🌙", title: "Menuju Ramadan", blurb: "Hitung mundur & checklist persiapan puasa.", on: () => featureRamadan() && featureRamadanReadiness() },
  { id: "ramadan-menu", since: "2027-02", icon: "🍽️", title: "Menu Sahur & Berbuka", blurb: "Ide menu harian yang menyesuaikan kondisi kesehatanmu.", on: () => featureRamadan() && featureRamadanMenu() },
  { id: "fasting-report", since: "2027-02", icon: "🩺", title: "Laporan Puasa untuk dokter", blurb: "Ringkas gula, tensi & obat selama puasa untuk dibawa konsultasi.", on: () => featureRamadan() && featureFastingReport() },
  { id: "ramadan-wrapped", since: "2027-02", icon: "✨", title: "Ramadan Wrapped", blurb: "Rekap perjalanan puasamu, siap dikenang.", on: () => featureRamadan() && featureRamadanWrapped() },
];

const thisMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export function WhatsNewCard() {
  // null = belum dicek (SSR-safe: localStorage hanya dibaca setelah mount)
  const [shown, setShown] = useState<Entry[] | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(KEY); } catch { /* mode privat → anggap belum ada */ }
    const s = parseWhatsNewSeen(raw, ENTRIES);
    setSeen(s);
    setShown(pendingWhatsNew(ENTRIES.filter((e) => e.on()), s, thisMonthKey()));
  }, []);

  if (!shown || shown.length === 0) return null;

  const close = () => {
    try { localStorage.setItem(KEY, serializeWhatsNewSeen(seen, shown.map((e) => e.id))); } catch { /* abaikan */ }
    setShown([]);
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>✨ Apa Baru</p>
        <button onClick={close} aria-label="Tutup" style={closeBtn}>Mengerti</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16, lineHeight: 1.3 }}>{e.icon}</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ah-text-primary)", lineHeight: 1.3 }}>{e.title}</p>
              <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", lineHeight: 1.4 }}>{e.blurb}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-gradient-soft, var(--ah-surface-1))", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const closeBtn: React.CSSProperties = {
  minHeight: 30, padding: "0 12px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-secondary)", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
};
