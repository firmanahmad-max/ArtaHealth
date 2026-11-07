"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { wrappedShareCard, type RamadanWrapped } from "@arta/core";
import { drawWrapped, canvasToImage, shareWrapped, downloadWrapped } from "@/lib/wrapped-image";

/**
 * Pratinjau + bagikan kartu gambar Ramadan Wrapped. Gambar dibuat di perangkat; tak ada yang
 * diunggah. Default privasi: tanpa qadha & tanpa persentase — pengguna bisa memilih menampilkan %.
 */
export function WrappedShareSheet({ w, startDate, inProgress, onClose }: {
  w: RamadanWrapped; startDate: string; inProgress: boolean; onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showPct, setShowPct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const card = useMemo(
    () => wrappedShareCard(w, { startDate, inProgress, showCompletion: showPct }),
    [w, startDate, inProgress, showPct],
  );

  useEffect(() => {
    if (card && canvasRef.current) drawWrapped(canvasRef.current, card);
  }, [card]);

  if (!card) return null;

  const run = async (mode: "share" | "download") => {
    if (!canvasRef.current || busy) return;
    setBusy(true); setMsg(null);
    try {
      const blob = await canvasToImage(canvasRef.current);
      if (mode === "share") {
        const r = await shareWrapped(blob, card.caption);
        if (r === "unsupported") { downloadWrapped(blob); setMsg("Perangkat ini belum mendukung bagikan langsung — gambar diunduh."); }
        else if (r === "shared") setMsg("Terkirim. Semoga jadi penyemangat! 🌙");
      } else {
        downloadWrapped(blob);
        setMsg("Gambar diunduh.");
      }
    } catch {
      setMsg("Gagal membuat gambar. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={sheet}>
      <canvas ref={canvasRef} aria-label={`Kartu ${card.title}: ${card.heroValue} ${card.heroLabel}`}
        style={{ width: "100%", maxWidth: 220, aspectRatio: "9 / 16", alignSelf: "center", borderRadius: 14, border: "1px solid var(--ah-border)" }} />

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--ah-text-secondary)", cursor: "pointer" }}>
        <input type="checkbox" checked={showPct} onChange={(e) => setShowPct(e.target.checked)} />
        Tampilkan persentase &amp; total hari
      </label>
      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Jumlah hari qadha tak pernah ikut di gambar. Gambar dibuat di perangkatmu — tidak diunggah.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void run("share")} disabled={busy} style={{ ...btn, ...primary }}>📤 Bagikan</button>
        <button onClick={() => void run("download")} disabled={busy} style={btn}>⬇️ Unduh</button>
        <button onClick={onClose} style={{ ...btn, flex: "0 0 auto" }}>Tutup</button>
      </div>
      {msg && <p role="status" style={{ fontSize: 11, color: "var(--ah-text-secondary)", textAlign: "center" }}>{msg}</p>}
    </div>
  );
}

const sheet: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 10, padding: 12,
  borderRadius: "var(--ah-r-inner)", background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
};
const btn: React.CSSProperties = {
  flex: 1, padding: "9px 10px", borderRadius: "var(--ah-r-chip)", cursor: "pointer", fontSize: 12, fontWeight: 700,
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", border: "1px solid var(--ah-border)",
};
const primary: React.CSSProperties = { background: "var(--ah-gradient-hero)", color: "#fff", border: "none" };
