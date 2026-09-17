"use client";
import { useEffect, useState } from "react";
import {
  featureFocus, featureWearable, featureRadar, featureSatuSehat, featureQuickLog,
} from "@/lib/features";

/**
 * "Apa Baru" (Fase 8 · KR-4) — kartu dismissible yang memperkenalkan fitur yang baru dinyalakan
 * ke pengguna lama. Hanya menampilkan entri yang flag-nya aktif; sekali "Mengerti" hilang permanen
 * (localStorage per-VERSION). Bump VERSION saat menambah entri baru → muncul lagi. Non-medis.
 */

const VERSION = "2026-09";
const KEY = "ah-whatsnew-seen";

interface Entry { id: string; icon: string; title: string; blurb: string; on: () => boolean }
const ENTRIES: Entry[] = [
  { id: "focus", icon: "🎯", title: "Fokus Hari Ini", blurb: "Ringkasan 1–3 hal penting untuk kamu lakukan hari ini.", on: featureFocus },
  { id: "wearable", icon: "⌚", title: "Impor data perangkat", blurb: "Bawa langkah, tidur & detak dari export Google Fit.", on: featureWearable },
  { id: "radar", icon: "🌫️", title: "Radar Sehat", blurb: "Pantau kualitas udara (AQI) di lokasimu.", on: featureRadar },
  { id: "satusehat", icon: "🔗", title: "Ekspor FHIR", blurb: "Kemas datamu ke berkas standar untuk dibawa ke faskes.", on: featureSatuSehat },
  { id: "quicklog", icon: "💬", title: "Catat lewat chat & suara", blurb: "Ketik atau ucapkan “minum 2 gelas” → langsung tercatat.", on: featureQuickLog },
  { id: "beranda", icon: "🧭", title: "Beranda lebih rapi", blurb: "Kartu dikelompokkan; alat sekunder bisa dilipat.", on: () => true },
];

export function WhatsNewCard() {
  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = belum dicek (SSR-safe)

  useEffect(() => {
    try { setDismissed(localStorage.getItem(KEY) === VERSION); } catch { setDismissed(false); }
  }, []);

  const entries = ENTRIES.filter((e) => e.on());
  if (dismissed !== false || entries.length === 0) return null;

  const close = () => {
    try { localStorage.setItem(KEY, VERSION); } catch { /* abaikan */ }
    setDismissed(true);
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>✨ Apa Baru</p>
        <button onClick={close} aria-label="Tutup" style={closeBtn}>Mengerti</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((e) => (
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
