"use client";
import { PAKET_FREE_CORE } from "@arta/core";

/**
 * Teaser fitur premium yang terkunci (Fase 9 · RW-4c). Hanya tampil bila sakelar paywall NYALA
 * dan pengguna belum punya Paket Ramadan/PRO. Jujur: tidak mendorong beli bila pembayaran belum
 * dibuka (`checkoutOpen` false → ajakan menunggu kabar). Inti keselamatan ditegaskan tetap gratis.
 */
export function PremiumLocked({ title, desc, compact = false, checkoutOpen = false }: {
  title: string; desc?: string; compact?: boolean; checkoutOpen?: boolean;
}) {
  const note = checkoutOpen
    ? "Termasuk Paket Ramadan & PRO."
    : "Termasuk Paket Ramadan & PRO — pembayaran segera dibuka.";
  if (compact) {
    return (
      <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", lineHeight: 1.45 }}>
        🔒 {title} · {note}
      </p>
    );
  }
  return (
    <div style={card}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🔒 {title}</p>
      {desc && <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.45 }}>{desc}</p>}
      <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>{note}</p>
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>{PAKET_FREE_CORE}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px dashed var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 6,
};
