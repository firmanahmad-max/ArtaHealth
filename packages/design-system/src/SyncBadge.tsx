"use client";

export interface SyncBadgeProps {
  /** jumlah entri outbox yang belum terkirim */
  pending: number;
  online: boolean;
}

/** Status sinkronisasi ringkas — status tidak pernah hanya warna (CONTEXT §5). */
export function SyncBadge({ pending, online }: SyncBadgeProps) {
  const label = !online
    ? "Offline — data aman tersimpan"
    : pending > 0
      ? `↻ ${pending} menunggu sinkron`
      : "✓ Tersinkron";
  const cssVar = !online ? "var(--ah-score-fair)" : pending > 0 ? "var(--ah-cyan)" : "var(--ah-score-excellent)";
  return (
    <span
      role="status"
      style={{
        fontSize: 11, fontWeight: 600, color: cssVar,
        border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-chip)",
        padding: "3px 8px", background: "var(--ah-surface-1)", whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {label}
    </span>
  );
}
