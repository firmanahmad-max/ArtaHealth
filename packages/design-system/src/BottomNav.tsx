"use client";

export interface BottomNavItem {
  key: string;
  label: string;
  icon: string;
  /** tab tengah "Catat" dirender sebagai FAB gradient */
  fab?: boolean;
}

export interface BottomNavProps {
  items: BottomNavItem[]; // 5 item (ui-ux-spec §2: BottomNav 5 tab)
  activeKey: string;
  onSelect: (key: string) => void;
}

/** 5 tab; ikon aktif diberi dot gradient + label; safe-area inset (ui-ux-spec §2). */
export function BottomNav({ items, activeKey, onSelect }: BottomNavProps) {
  return (
    <nav
      aria-label="Navigasi utama"
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
        display: "flex", justifyContent: "space-around", alignItems: "flex-end",
        maxWidth: 480, margin: "0 auto",
        background: "var(--ah-surface-glass)", backdropFilter: "blur(16px)",
        borderTop: "1px solid var(--ah-border)",
        paddingTop: 8,
        paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        if (item.fab) {
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              aria-label={item.label}
              style={{
                width: 52, height: 52, marginTop: -22,
                borderRadius: "var(--ah-r-full)", border: "none",
                background: "var(--ah-gradient-hero)", color: "#fff",
                fontSize: 24, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 6px 20px rgba(59,130,246,.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {item.icon}
            </button>
          );
        }
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            aria-current={active ? "page" : undefined}
            style={{
              minWidth: 56, minHeight: 44, padding: "2px 6px",
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{ fontSize: 20, filter: active ? "none" : "grayscale(1) opacity(.55)" }}>{item.icon}</span>
            <span
              style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? "var(--ah-text-primary)" : "var(--ah-text-tertiary)",
              }}
            >
              {item.label}
            </span>
            <span
              aria-hidden
              style={{
                width: 4, height: 4, borderRadius: "var(--ah-r-full)",
                background: active ? "var(--ah-gradient-hero)" : "transparent",
              }}
            />
          </button>
        );
      })}
    </nav>
  );
}
