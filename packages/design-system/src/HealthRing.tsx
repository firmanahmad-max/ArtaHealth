"use client";
import { useEffect, useRef, useState } from "react";

export function scoreBand(score: number): { label: string; cssVar: string } {
  if (score >= 85) return { label: "Sangat Baik", cssVar: "var(--ah-score-excellent)" };
  if (score >= 70) return { label: "Baik", cssVar: "var(--ah-score-good)" };
  if (score >= 50) return { label: "Cukup", cssVar: "var(--ah-score-fair)" };
  return { label: "Perlu Perhatian", cssVar: "var(--ah-score-low)" };
}

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useCountUp(target: number, durationMs = 1200): number {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (prefersReduced()) { setVal(target); prev.current = target; return; }
    const from = prev.current, start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

export interface HealthRingProps {
  score: number;                 // 0–100
  size?: 48 | 96 | 168;
  strokeWidth?: number;
  showLabel?: boolean;
}

/** Signature component — satu-satunya tempat "boros" motion & gradien (ui-ux-spec §2.1). */
export function HealthRing({ score, size = 168, strokeWidth = 12, showLabel = true }: HealthRingProps) {
  const displayed = useCountUp(score);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const [sweep, setSweep] = useState(prefersReduced() ? score : 0);
  useEffect(() => {
    if (prefersReduced()) { setSweep(score); return; }
    const id = requestAnimationFrame(() => setSweep(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  const band = scoreBand(score);
  const gid = `ah-hero-${size}`;
  return (
    <div
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Health Score ${score} dari 100, ${band.label}`}
      style={{ position: "relative", width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ah-blue)" />
            <stop offset="50%" stopColor="var(--ah-cyan)" />
            <stop offset="100%" stopColor="var(--ah-purple)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ah-surface-2)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gid})`} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * sweep) / 100}
          style={{ transition: "stroke-dashoffset var(--ah-dur-slow) var(--ah-ease-out)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <div style={{ fontSize: size >= 160 ? 44 : size >= 90 ? 24 : 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ah-text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {displayed}
          {size >= 90 && <span style={{ fontSize: size >= 160 ? 16 : 11, color: "var(--ah-text-tertiary)", fontWeight: 500 }}>/100</span>}
        </div>
        {showLabel && size >= 90 && (
          <div style={{ fontSize: 12, fontWeight: 600, color: band.cssVar }}>{band.label}</div>
        )}
      </div>
    </div>
  );
}
