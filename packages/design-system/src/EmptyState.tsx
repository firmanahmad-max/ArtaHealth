"use client";

export interface EmptyStateProps {
  /** pose Arta Bot berbeda per konteks (ui-ux-spec §2) — emoji placeholder hingga aset ilustrasi siap */
  icon?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

/** Empty state: ilustrasi + copy hangat + tepat 1 CTA (ui-ux-spec §2). */
export function EmptyState({ icon = "🤖", title, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ah-text-primary)" }}>{title}</p>
      {description && <p style={{ fontSize: 13, color: "var(--ah-text-secondary)", maxWidth: 280 }}>{description}</p>}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 6, minHeight: 44, padding: "0 20px", borderRadius: "var(--ah-r-full)",
            border: "none", background: "var(--ah-gradient-hero)", color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
