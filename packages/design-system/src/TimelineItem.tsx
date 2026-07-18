"use client";

export interface TimelineItemProps {
  /** "07:30" — kolom kiri lebar tetap 48px (ui-ux-spec §2.5) */
  time: string;
  icon: string;
  /** warna domain, mis. "var(--ah-hydration)" — timeline terbaca sekilas tanpa teks */
  domainCssVar: string;
  title: string;
  detail?: string;
  chip?: string;
  pendingSync?: boolean;
  /** true → garis vertikal tidak diteruskan ke bawah */
  isLast?: boolean;
}

export function TimelineItem({ time, icon, domainCssVar, title, detail, chip, pendingSync, isLast }: TimelineItemProps) {
  return (
    <div style={{ display: "flex", gap: 10, opacity: pendingSync ? 0.75 : 1 }}>
      <div style={{ width: 48, flexShrink: 0, fontSize: 11, color: "var(--ah-text-tertiary)", fontVariantNumeric: "tabular-nums", paddingTop: 8, textAlign: "right" }}>
        {time}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <span
          aria-hidden
          style={{
            width: 30, height: 30, borderRadius: "var(--ah-r-full)", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--ah-surface-2)", border: `1.5px solid ${domainCssVar}`,
          }}
        >
          {icon}
        </span>
        {!isLast && <span aria-hidden style={{ width: 2, flex: 1, minHeight: 8, background: "var(--ah-border)" }} />}
      </div>
      <div
        style={{
          flex: 1, minWidth: 0, marginBottom: 10, padding: "10px 12px",
          background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
          borderRadius: "var(--ah-r-inner)",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ah-text-primary)" }}>{title}</p>
          {detail && <p style={{ fontSize: 12, color: "var(--ah-text-secondary)" }}>{detail}</p>}
        </div>
        {chip && (
          <span style={{ fontSize: 11, fontWeight: 600, color: domainCssVar, whiteSpace: "nowrap" }}>{chip}</span>
        )}
        {pendingSync && <span aria-label="Menunggu sinkron" title="Menunggu sinkron" style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }}>↻</span>}
      </div>
    </div>
  );
}
