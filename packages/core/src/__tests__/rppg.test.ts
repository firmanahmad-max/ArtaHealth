import { describe, it, expect } from "vitest";
import { estimateHeartRate, type RppgSample } from "../rppg.ts";

/** LCG deterministik → derau stabil lintas run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

/**
 * Sinyal PPG sintetis: DC 128 + baseline wander lambat + gelombang denyut pada `bpm`
 * + derau. `fps` frame/detik selama `secs` detik.
 */
function synth(bpm: number, secs: number, fps: number, noise = 2, seed = 1): RppgSample[] {
  const rand = rng(seed);
  const f = bpm / 60;
  const out: RppgSample[] = [];
  const dt = 1000 / fps;
  const nn = Math.round(secs * fps);
  for (let i = 0; i < nn; i++) {
    const tSec = i / fps;
    const pulse = 10 * Math.sin(2 * Math.PI * f * tSec);
    const wander = 4 * Math.sin(2 * Math.PI * 0.15 * tSec); // ~9/menit (napas), harus dibuang bandpass
    const noiseV = (rand() - 0.5) * 2 * noise;
    out.push({ t: i * dt, value: 128 + pulse + wander + noiseV });
  }
  return out;
}

describe("estimateHeartRate — akurasi sinyal bersih", () => {
  for (const bpm of [50, 60, 72, 100, 140]) {
    it(`estimasi ~${bpm} BPM (±3)`, () => {
      const r = estimateHeartRate(synth(bpm, 15, 30, 1.5, bpm));
      expect(r.status).toBe("ok");
      expect(r.bpm).not.toBeNull();
      expect(Math.abs(r.bpm! - bpm)).toBeLessThanOrEqual(3);
      expect(r.confidence).toBeGreaterThan(0.5);
    });
  }
});

describe("estimateHeartRate — tahan baseline wander", () => {
  it("napas lambat tak tertukar jadi denyut", () => {
    const r = estimateHeartRate(synth(72, 15, 30, 2, 7));
    expect(r.status).toBe("ok");
    expect(Math.abs(r.bpm! - 72)).toBeLessThanOrEqual(3); // bukan ~9 (napas)
  });
});

describe("estimateHeartRate — gerbang kualitas", () => {
  it("durasi terlalu pendek → insufficient", () => {
    const r = estimateHeartRate(synth(72, 3, 30));
    expect(r.status).toBe("insufficient");
    expect(r.bpm).toBeNull();
  });

  it("frame rate terlalu rendah → insufficient", () => {
    const r = estimateHeartRate(synth(72, 15, 5)); // 5 fps < minFs 10
    expect(r.status).toBe("insufficient");
  });

  it("sinyal datar (tak ada jari) → low_quality, tanpa BPM andal", () => {
    const flat: RppgSample[] = [];
    for (let i = 0; i < 450; i++) flat.push({ t: (i * 1000) / 30, value: 20 }); // konstan → r0=0
    const r = estimateHeartRate(flat);
    expect(r.status).toBe("low_quality");
    expect(r.bpm).toBeNull();
  });

  it("derau dominan (jari bergerak) → confidence rendah", () => {
    const r = estimateHeartRate(synth(72, 15, 30, 40, 3)); // derau >> denyut
    expect(["low_quality", "ok"]).toContain(r.status);
    if (r.status === "ok") expect(r.confidence).toBeGreaterThan(0.5);
    else expect(r.confidence).toBeLessThan(0.5);
  });

  it("sampel kosong → insufficient", () => {
    expect(estimateHeartRate([]).status).toBe("insufficient");
  });
});

describe("estimateHeartRate — metadata", () => {
  it("fs & durasi dihitung dari timestamp", () => {
    const r = estimateHeartRate(synth(72, 12, 30));
    expect(r.fs).toBeGreaterThan(28);
    expect(r.fs).toBeLessThan(32);
    expect(r.durationSec).toBeGreaterThan(11);
    expect(r.samples).toBeGreaterThan(300);
  });
});
