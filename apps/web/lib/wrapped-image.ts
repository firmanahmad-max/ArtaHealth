"use client";
import type { WrappedShareCard } from "@arta/core";

/**
 * Ramadan Wrapped → gambar JPEG 1080×1920 (format story) digambar di <canvas> SEPENUHNYA di
 * perangkat (tanpa server, tanpa unggah). Lalu dibagikan via Web Share (file) bila didukung,
 * atau diunduh. Warna literal di sini disengaja: kanvas tak bisa membaca token CSS dan gambar harus
 * tampil sama di mana pun dibagikan.
 */

export const WRAPPED_W = 1080;
export const WRAPPED_H = 1920;
const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Gambar kartu ke kanvas (dipisah agar bisa dipratinjau tanpa membuat blob). */
export function drawWrapped(canvas: HTMLCanvasElement, c: WrappedShareCard): void {
  canvas.width = WRAPPED_W;
  canvas.height = WRAPPED_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cx = WRAPPED_W / 2;

  // Latar: gradien malam + cahaya lembut
  const bg = ctx.createLinearGradient(0, 0, WRAPPED_W, WRAPPED_H);
  bg.addColorStop(0, "#0A0E1A");
  bg.addColorStop(0.55, "#1B1840");
  bg.addColorStop(1, "#0E2A3A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WRAPPED_W, WRAPPED_H);
  const glow = ctx.createRadialGradient(cx, 620, 40, cx, 620, 620);
  glow.addColorStop(0, "rgba(139,92,246,0.35)");
  glow.addColorStop(1, "rgba(139,92,246,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WRAPPED_W, WRAPPED_H);

  // Bintang kecil (pola tetap → gambar deterministik)
  ctx.fillStyle = "rgba(243,246,255,0.55)";
  for (let i = 0; i < 40; i++) {
    const x = (i * 263) % WRAPPED_W, y = (i * 151) % 900 + 40, r = (i % 3) + 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Bulan sabit
  // Bulan sabit — dipotong di kanvas terpisah agar latar utama tak ikut berlubang
  const moon = document.createElement("canvas");
  moon.width = 200; moon.height = 200;
  const m = moon.getContext("2d");
  if (m) {
    m.fillStyle = "#FDE68A";
    m.beginPath(); m.arc(100, 100, 92, 0, Math.PI * 2); m.fill();
    m.globalCompositeOperation = "destination-out";
    m.beginPath(); m.arc(144, 70, 84, 0, Math.PI * 2); m.fill();
    ctx.drawImage(moon, cx - 100, 200);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#F3F6FF";
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(c.title, cx, 520);
  ctx.fillStyle = "#9AA5C4";
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText(c.subtitle, cx, 588);

  // Angka utama
  const hero = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0);
  hero.addColorStop(0, "#22D3EE");
  hero.addColorStop(1, "#A78BFA");
  ctx.fillStyle = hero;
  ctx.font = `900 360px ${FONT}`;
  ctx.fillText(c.heroValue, cx, 960);
  ctx.fillStyle = "#F3F6FF";
  ctx.font = `700 58px ${FONT}`;
  ctx.fillText(c.heroLabel, cx, 1050);

  // Stat
  if (c.stats.length) {
    const boxW = 400, boxH = 190, gap = 40;
    const totalW = c.stats.length * boxW + (c.stats.length - 1) * gap;
    c.stats.forEach((s, i) => {
      const x = cx - totalW / 2 + i * (boxW + gap), y = 1140;
      roundRect(ctx, x, y, boxW, boxH, 36);
      ctx.fillStyle = "rgba(26,33,56,0.78)"; ctx.fill();
      ctx.strokeStyle = "rgba(148,163,208,0.25)"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#F3F6FF"; ctx.font = `800 72px ${FONT}`;
      ctx.fillText(s.value, x + boxW / 2, y + 96);
      ctx.fillStyle = "#9AA5C4"; ctx.font = `500 36px ${FONT}`;
      ctx.fillText(s.label, x + boxW / 2, y + 150);
    });
  }

  // Headline
  ctx.fillStyle = "#FDE68A";
  ctx.font = `700 54px ${FONT}`;
  wrapLines(ctx, c.headline, WRAPPED_W - 200).forEach((l, i) => ctx.fillText(l, cx, 1480 + i * 72));

  // Merek
  ctx.fillStyle = "#9AA5C4";
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText("ArtaHealth", cx, 1800);
  ctx.fillStyle = "#5E6A8C";
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText("artahealth.firmanahmad.id", cx, 1848);
}

/** JPEG q0.92 (~10× lebih kecil dari PNG untuk gradien 1080×1920) → cepat dibagikan di seluler. */
export function canvasToImage(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob gagal"))), "image/jpeg", 0.92));
}

export const WRAPPED_FILENAME = "ramadan-wrapped.jpg";

/** Bagikan via Web Share (file) bila didukung. "shared" | "cancelled" | "unsupported". */
export async function shareWrapped(blob: Blob, caption: string): Promise<"shared" | "cancelled" | "unsupported"> {
  const file = new File([blob], WRAPPED_FILENAME, { type: blob.type || "image/jpeg" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return "unsupported";
  try {
    await nav.share({ files: [file], text: caption });
    return "shared";
  } catch {
    return "cancelled"; // pengguna menutup lembar bagikan / AbortError
  }
}

export function downloadWrapped(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = WRAPPED_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
