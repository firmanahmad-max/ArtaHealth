"use client";
/**
 * Voice quick-log — dikte suara via Web Speech API (SpeechRecognition, id-ID). Hasil teks
 * dimasukkan ke input chat lalu diproses jalur biasa (quick-log/AI). Didukung Chrome/Edge;
 * tak tersedia di sebagian browser → tombol disembunyikan.
 */

type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

const getCtor = (): (new () => SpeechRec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechSupported = (): boolean => getCtor() !== null;

export interface Dictation { stop: () => void; }

/** Mulai dikte satu ucapan. Kembalikan handle stop, atau null bila tak didukung/gagal. */
export function startDictation(
  onResult: (text: string) => void,
  onEnd?: () => void,
  onError?: (message: string) => void,
): Dictation | null {
  const Ctor = getCtor();
  if (!Ctor) { onError?.("Input suara tak didukung di browser ini."); return null; }
  const rec = new Ctor();
  rec.lang = "id-ID"; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const t = e?.results?.[0]?.[0]?.transcript ?? "";
    if (t) onResult(String(t).trim());
  };
  rec.onerror = (e) => onError?.(e?.error === "not-allowed" ? "Izin mikrofon ditolak." : "Gagal mendengarkan.");
  rec.onend = () => onEnd?.();
  try { rec.start(); } catch { onError?.("Gagal memulai mikrofon."); return null; }
  return { stop: () => { try { rec.stop(); } catch { /* noop */ } } };
}
