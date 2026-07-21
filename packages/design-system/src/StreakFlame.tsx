"use client";
import { useEffect, useRef, useState } from "react";

export interface StreakFlameProps {
  /** streak berjalan (hari) */
  streak: number;
}

/** Api streak — pulse sekali saat angka naik (ui-ux §4: 250ms), hormati reduced-motion. */
export function StreakFlame({ streak }: StreakFlameProps) {
  const prev = useRef(streak);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (streak > prev.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 300);
      prev.current = streak;
      return () => clearTimeout(t);
    }
    prev.current = streak;
  }, [streak]);

  return (
    <span
      role="img"
      aria-label={`Streak ${streak} hari`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
        color: streak > 0 ? "var(--ah-nutrition)" : "var(--ah-text-tertiary)",
        border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-chip)",
        padding: "3px 8px", background: "var(--ah-surface-1)",
        fontVariantNumeric: "tabular-nums",
        animation: pulse ? "ah-flame-pulse var(--ah-dur-fast) var(--ah-ease-spring)" : undefined,
      }}
    >
      <span aria-hidden style={{ filter: streak > 0 ? "none" : "grayscale(1) opacity(.6)" }}>🔥</span>
      {streak} hari
      <style>{`@keyframes ah-flame-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }`}</style>
    </span>
  );
}
