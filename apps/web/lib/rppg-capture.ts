"use client";
import { estimateHeartRate, type RppgSample, type RppgResult } from "@arta/core";

/**
 * Tangkap sinyal rPPG dari kamera belakang + flash (Fase 6 #3, RP-1 PoC).
 * Semua diproses ON-DEVICE: tiap frame → rata-rata kanal merah di kotak tengah →
 * sampel; video/gambar TAK diunggah & TAK disimpan. Hasil akhir = estimasi BPM
 * (engine deterministik core). Bukan alat medis (docs/addendum-rppg.md).
 */

export interface CaptureHandle {
  stop: () => Promise<RppgResult>;   // hentikan lebih awal → hasil dari sampel terkumpul
  cancel: () => void;                 // batal tanpa hasil (matikan kamera)
}

export interface CaptureCallbacks {
  onProgress?: (elapsedSec: number, totalSec: number, latest: number) => void;
  onDone?: (result: RppgResult) => void;
  onError?: (err: Error) => void;
}

export interface CaptureOptions {
  durationSec?: number;   // default 18
  box?: number;           // ukuran kotak sampel px (default 64)
}

/** Cek dukungan dasar (dipanggil sebelum memulai untuk pesan yang ramah). */
export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Mulai pengukuran. Mengembalikan handle untuk stop/cancel; hasil via onDone/return stop().
 * Torch dinyalakan bila didukung (tidak semua device) — tanpa torch, sinyal lebih lemah.
 */
export async function startPulseCapture(
  opts: CaptureOptions = {},
  cb: CaptureCallbacks = {},
): Promise<CaptureHandle> {
  const durationSec = opts.durationSec ?? 18;
  const box = opts.box ?? 64;

  if (!cameraSupported()) throw new Error("Kamera tidak didukung di perangkat/browser ini.");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  const track = stream.getVideoTracks()[0]!;

  // Coba nyalakan torch (best-effort; abaikan bila tak didukung).
  try {
    const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
    if (caps.torch) await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
  } catch { /* torch opsional */ }

  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.muted = true;
  video.srcObject = stream;
  await video.play().catch(() => { /* beberapa browser butuh interaksi; caller memicu via klik */ });

  const canvas = document.createElement("canvas");
  canvas.width = box; canvas.height = box;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const samples: RppgSample[] = [];
  const startT = performance.now();
  let raf = 0;
  let finished = false;

  const teardown = () => {
    if (raf) cancelAnimationFrame(raf);
    try {
      const t = stream.getVideoTracks()[0];
      const tcaps = (t?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      if (tcaps.torch) void t!.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] });
    } catch { /* noop */ }
    stream.getTracks().forEach((tr) => tr.stop());
    video.srcObject = null;
  };

  const finalize = (): RppgResult => {
    if (!finished) { finished = true; teardown(); }
    const result = estimateHeartRate(samples);
    return result;
  };

  const tick = () => {
    if (finished) return;
    const now = performance.now();
    const elapsed = (now - startT) / 1000;
    try {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        // ambil kotak tengah frame → rata-rata kanal merah
        const sx = Math.max(0, (vw - box) / 2), sy = Math.max(0, (vh - box) / 2);
        ctx.drawImage(video, sx, sy, box, box, 0, 0, box, box);
        const { data } = ctx.getImageData(0, 0, box, box);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += data[i]!; // kanal R
        const redMean = sum / (data.length / 4);
        samples.push({ t: now - startT, value: redMean });
        cb.onProgress?.(elapsed, durationSec, redMean);
      }
    } catch (e) {
      finished = true; teardown();
      cb.onError?.(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    if (elapsed >= durationSec) {
      const result = finalize();
      cb.onDone?.(result);
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop: async () => { const r = finalize(); cb.onDone?.(r); return r; },
    cancel: () => { if (!finished) { finished = true; teardown(); } },
  };
}
