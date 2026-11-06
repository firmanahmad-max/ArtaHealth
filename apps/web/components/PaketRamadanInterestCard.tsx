"use client";
import { useEffect, useState } from "react";
import {
  PAKET_TIERS, PAKET_BENEFITS, PAKET_FREE_CORE, formatRupiah, type PaketChoice,
} from "@arta/core";
import { getPaketChoice, savePaketChoice, retryPaketSync } from "@/lib/paket-interest";
import { useMounted } from "@/lib/useMounted";

/**
 * Validasi minat Paket Ramadan (Fase 9 · RW-4a) — waitlist TANPA pembayaran. Pengguna memilih
 * tingkat yang diminati atau "belum perlu"; setelah memilih, kartu menyusut jadi satu baris
 * (tak mengganggu). Inti Mode Ramadan tetap gratis. Flag NEXT_PUBLIC_FEATURE_PAKET_INTEREST.
 */

const LABEL: Record<PaketChoice, string> = {
  season: "Paket Ramadan", season_syawal: "Ramadan + Syawal", pro_annual: "PRO Tahunan", not_now: "Belum perlu",
};

export function PaketRamadanInterestCard() {
  const mounted = useMounted();
  const [choice, setChoice] = useState<PaketChoice | null | undefined>(undefined); // undefined = memuat
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    void getPaketChoice().then(setChoice);
    void retryPaketSync();
  }, [mounted]);

  if (choice === undefined) return null;

  const pick = async (c: PaketChoice) => {
    await savePaketChoice(c);
    setChoice(c);
    setEditing(false);
  };

  if (choice && !editing) {
    return (
      <div style={{ ...card, flexDirection: "row", alignItems: "center", gap: 10, padding: "10px 14px" }}>
        <span style={{ fontSize: 16 }}>🌙</span>
        <p style={{ flex: 1, fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.4 }}>
          {choice === "not_now"
            ? "Terima kasih — kamu memilih belum perlu Paket Ramadan."
            : <>Terima kasih — minatmu pada <b>{LABEL[choice]}</b> tercatat. Kami kabari saat tersedia.</>}
        </p>
        <button onClick={() => setEditing(true)} style={linkBtn}>Ubah</button>
      </div>
    );
  }

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🌙 Paket Ramadan — segera hadir</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Belum ada pembayaran. Kami hanya ingin tahu: apakah ini berguna buatmu?
        </p>
      </div>

      <ul style={{ display: "flex", flexDirection: "column", gap: 4, listStyle: "none" }}>
        {PAKET_BENEFITS.map((b) => (
          <li key={b} style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", display: "flex", gap: 6 }}>
            <span aria-hidden style={{ color: "var(--ah-purple)" }}>✦</span>{b}
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PAKET_TIERS.map((t) => (
          <button key={t.id} onClick={() => void pick(t.id)} style={{ ...tierBtn, borderColor: choice === t.id ? "var(--ah-purple)" : "var(--ah-border)" }}>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ah-text-primary)" }}>{t.label}</p>
              <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)" }}>{t.desc}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "var(--ah-text-primary)" }}>{formatRupiah(t.priceIdr)}</p>
              <p style={{ fontSize: 9.5, color: "var(--ah-text-tertiary)" }}>{t.period}</p>
            </div>
          </button>
        ))}
        <button onClick={() => void pick("not_now")} style={linkBtn}>Belum perlu</button>
      </div>

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>{PAKET_FREE_CORE}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-gradient-soft)",
  border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-card)", padding: 14,
  display: "flex", flexDirection: "column", gap: 12,
};
const tierBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer",
  borderRadius: "var(--ah-r-inner)", background: "var(--ah-surface-1)", border: "1.5px solid",
};
const linkBtn: React.CSSProperties = {
  alignSelf: "center", background: "transparent", border: "none", cursor: "pointer",
  color: "var(--ah-text-tertiary)", fontSize: 11.5, fontWeight: 700, padding: "4px 8px",
};
