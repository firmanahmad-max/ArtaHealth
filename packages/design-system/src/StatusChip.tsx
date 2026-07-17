export function StatusChip({ label, cssVar }: { label: string; cssVar: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: cssVar, background: `color-mix(in srgb, ${cssVar} 12%, transparent)`, padding: "3px 9px", borderRadius: "var(--ah-r-full)", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}
