"use client";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Bagian Beranda berlabel (Fase 8 · KR-3 organisasi Beranda). Mengelompokkan kartu agar scroll
 * panjang jadi navigable. Bila `collapsible`, bisa dilipat (default per `defaultCollapsed`) dan
 * status disimpan di localStorage (`storageKey`) — hydration-safe (baca localStorage setelah mount).
 */
export function DashboardSection({
  title, count, collapsible = false, defaultCollapsed = false, storageKey, children,
}: {
  title: string; count: number; collapsible?: boolean; defaultCollapsed?: boolean;
  storageKey?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);

  useEffect(() => {
    if (!collapsible || !storageKey) return;
    try {
      const v = localStorage.getItem(storageKey);
      if (v != null) setOpen(v === "1");
    } catch { /* localStorage bisa dilarang → pakai default */ }
  }, [collapsible, storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) { try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* abaikan */ } }
      return next;
    });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {collapsible ? (
        <button onClick={toggle} aria-expanded={open} style={headerBtn}>
          <span>{title} · {count}</span>
          <span aria-hidden style={{ fontSize: 11 }}>{open ? "▾ sembunyikan" : "▸ tampilkan"}</span>
        </button>
      ) : (
        <p style={headerLabel}>{title} · {count}</p>
      )}
      {open && children}
    </section>
  );
}

const headerLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)",
  textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 2px",
};
const headerBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  background: "transparent", border: "none", cursor: "pointer", padding: "2px 2px",
  fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)",
  textTransform: "uppercase", letterSpacing: 0.5,
};
