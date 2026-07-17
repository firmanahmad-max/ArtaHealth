"use client";
import { StatusChip } from "./StatusChip";

export interface MetricCardProps {
  icon: string; name: string;
  value: string | null; unit?: string;
  chip?: string; chipCssVar?: string;
  pendingSync?: boolean;
  onLog?: () => void;
}

/** 5-state sesuai spec: default / empty ("+ Catat") / offline-pending; skeleton & error di level parent. */
export function MetricCard({ icon, name, value, unit, chip, chipCssVar, pendingSync, onLog }: MetricCardProps) {
  return (
    <div style={{ background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-inner)", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", minWidth: 0, position: "relative" }}>
      {pendingSync && <span aria-label="Menunggu sinkron" title="Menunggu sinkron" style={{ position: "absolute", top: 8, right: 8, fontSize: 10, color: "var(--ah-text-tertiary)" }}>↻</span>}
      <div style={{ fontSize: 16 }}>{icon}</div>
      <div style={{ fontSize: 11, color: "var(--ah-text-secondary)", fontWeight: 500 }}>{name}</div>
      {value === null ? (
        <button onClick={onLog} style={{ fontSize: 12, fontWeight: 600, color: "var(--ah-cyan)", background: "transparent", border: "1px dashed var(--ah-border)", borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>
          + Catat
        </button>
      ) : (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ah-text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, whiteSpace: "nowrap" }}>
            {value}
            {unit && <span style={{ fontSize: 10, color: "var(--ah-text-tertiary)", fontWeight: 500, marginLeft: 2 }}>{unit}</span>}
          </div>
          {chip && chipCssVar && <StatusChip label={chip} cssVar={chipCssVar} />}
        </>
      )}
    </div>
  );
}
