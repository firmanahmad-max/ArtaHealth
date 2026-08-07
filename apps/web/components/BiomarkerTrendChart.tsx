"use client";
import type { Band, Zone } from "@arta/core";

/**
 * Trend biomarker dengan PITA ZONA (addendum §2.4): garis nilai dari waktu ke
 * waktu di atas latar zona guideline berwarna, sehingga pengguna melihat langsung
 * ke arah mana angkanya bergerak relatif ambang. Murni SVG, tanpa dependensi chart.
 * Titik diberi jarak merata (bukan skala waktu) agar 3–30 pembacaan tetap terbaca.
 */

const ZONE_FILL: Record<Zone, string> = {
  green: "rgba(52, 211, 153, 0.16)",
  yellow: "rgba(251, 191, 36, 0.18)",
  orange: "rgba(251, 146, 60, 0.20)",
  red: "rgba(248, 113, 113, 0.20)",
};

const W = 300;
const H = 110;
const PAD = { top: 8, right: 8, bottom: 8, left: 30 };

export interface TrendPoint { value: number; label: string }

export function BiomarkerTrendChart({
  points, bands, unit, caption,
}: {
  /** urut lama → baru */
  points: TrendPoint[];
  /** band parameter yang diplot (untuk pita zona sumbu-Y) */
  bands: Band[];
  unit: string;
  caption: string;
}) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const pad = Math.max(5, (dataMax - dataMin) * 0.18);
  const yMin = dataMin - pad;
  const yMax = dataMax + pad;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  // pita zona: klip tiap band ke [yMin, yMax] yang terlihat
  const stripes = bands
    .map((b) => {
      const lo = b.minValue ?? yMin;
      const hi = b.maxValue ?? yMax;
      const top = Math.min(hi, yMax);
      const bottom = Math.max(lo, yMin);
      if (top <= bottom) return null;
      return { yTop: y(top), height: y(bottom) - y(top), zone: b.zone, key: b.bandKey };
    })
    .filter((s): s is { yTop: number; height: number; zone: Zone; key: string } => s !== null);

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const last = points[points.length - 1]!;

  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={caption} style={{ display: "block" }}>
        {stripes.map((s) => (
          <rect key={s.key} x={PAD.left} y={s.yTop} width={W - PAD.left - PAD.right} height={s.height} fill={ZONE_FILL[s.zone]} />
        ))}
        {/* garis batas atas & bawah domain (nilai acuan) */}
        <text x={PAD.left - 4} y={y(dataMax)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--ah-text-tertiary)">{dataMax}</text>
        <text x={PAD.left - 4} y={y(dataMin)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--ah-text-tertiary)">{dataMin}</text>
        <polyline points={line} fill="none" stroke="var(--ah-text-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 3.5 : 2} fill="var(--ah-text-primary)" />
        ))}
      </svg>
      <figcaption style={{ fontSize: 10, color: "var(--ah-text-tertiary)", display: "flex", justifyContent: "space-between" }}>
        <span>{caption}</span>
        <span>terbaru: {last.value} {unit}</span>
      </figcaption>
    </figure>
  );
}
