"use client";
import { useState } from "react";
import QRCode from "qrcode";
import type { ConsultationReport } from "@arta/core";
import { consultationReport } from "@/lib/consultation";
import { createShareLink, revokeShareLink, type ShareLink } from "@/lib/consultation-share";
import { ConsultationReportView } from "./ConsultationReportView";

/**
 * Mode Konsultasi — Laporan Dokter (V3-1). MK-1: buat laporan 90 hari → tampil/cetak.
 * MK-2: bagikan via QR + link read-only ber-TTL (snapshot terenkripsi server-side) +
 * cabut. On-device untuk pembuatan; berbagi lewat Edge Function. Flag
 * NEXT_PUBLIC_FEATURE_CONSULTATION. Non-diagnosis.
 */

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

export function ConsultationReportCard() {
  const [report, setReport] = useState<ConsultationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState<ShareLink | null>(null);
  const [qr, setQr] = useState<string>("");
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try { setReport(await consultationReport()); }
    finally { setLoading(false); }
  };

  const doShare = async () => {
    if (!report) return;
    setSharing(true); setShareMsg("");
    try {
      const res = await createShareLink(report);
      if (!res.ok) { setShareMsg(res.message); return; }
      setShare(res.link);
      try { setQr(await QRCode.toDataURL(res.link.url, { margin: 1, width: 220 })); } catch { setQr(""); }
    } finally { setSharing(false); }
  };

  const doRevoke = async () => {
    if (!share) return;
    await revokeShareLink(share.token);
    setShare(null); setQr(""); setShareMsg("Link dicabut.");
  };

  const copy = async () => {
    if (!share) return;
    try { await navigator.clipboard.writeText(share.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  };

  const reset = () => { setReport(null); setShare(null); setQr(""); setShareMsg(""); };

  return (
    <div style={card} className="ah-consult">
      <style>{`@media print{body *{visibility:hidden}.ah-consult,.ah-consult *{visibility:visible}.ah-consult{position:absolute;left:0;top:0;width:100%;border:none}.ah-noprint{display:none!important}}`}</style>

      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🩺 Mode Konsultasi</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Ringkasan 90 hari untuk dibawa ke dokter. Dibuat di perangkatmu — bukan diagnosis.
        </p>
      </div>

      {!report && (
        <button onClick={() => void generate()} disabled={loading} style={primaryBtn} className="ah-noprint">
          {loading ? "Menyiapkan…" : "Buat laporan konsultasi"}
        </button>
      )}

      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ConsultationReportView report={report} />

          {/* Berbagi (MK-2) */}
          {share && (
            <div style={shareBox} className="ah-noprint">
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ah-text-primary)" }}>Bagikan ke dokter</p>
              {qr && <img src={qr} alt="QR laporan" style={{ width: 180, height: 180, alignSelf: "center", background: "#fff", borderRadius: 8, padding: 6 }} />}
              <p style={{ fontSize: 11, color: "var(--ah-text-secondary)", wordBreak: "break-all" }}>{share.url}</p>
              <p style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)" }}>
                ⏳ Berlaku sampai {fmtTime(share.expiresAt)}. Siapa pun dengan link ini bisa membuka laporan selama masih berlaku.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => void copy()} style={ghostBtn}>{copied ? "Tersalin ✓" : "Salin link"}</button>
                <button onClick={() => void doRevoke()} style={dangerBtn}>Cabut akses</button>
              </div>
            </div>
          )}
          {shareMsg && !share && (
            <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)" }} className="ah-noprint">{shareMsg}</p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} className="ah-noprint">
            <button onClick={() => window.print()} style={primaryBtn}>🖨️ Cetak / PDF</button>
            {!share && (
              <button onClick={() => void doShare()} disabled={sharing || report.isEmpty} style={primaryBtn}>
                {sharing ? "Membuat…" : "🔗 Bagikan (QR)"}
              </button>
            )}
            <button onClick={reset} style={ghostBtn}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const shareBox: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8, background: "var(--ah-surface-2)",
  borderRadius: "var(--ah-r-inner)", padding: 12,
};
const primaryBtn: React.CSSProperties = {
  minHeight: 44, flex: 1, minWidth: 130, borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  minHeight: 40, flex: 1, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
  background: "transparent", color: "var(--ah-text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const dangerBtn: React.CSSProperties = {
  minHeight: 40, flex: 1, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-score-low)",
  background: "transparent", color: "var(--ah-score-low)", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
