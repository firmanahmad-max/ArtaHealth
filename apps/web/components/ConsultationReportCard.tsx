"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { filterReport, narrativeSummary, type ConsultationReport, type ReportSection } from "@arta/core";
import { consultationReport } from "@/lib/consultation";
import { createShareLink, revokeShareLink, type ShareLink } from "@/lib/consultation-share";
import { featureFamily } from "@/lib/features";
import { familyMembers } from "@/lib/family";
import { ConsultationReportView } from "./ConsultationReportView";

/**
 * Mode Konsultasi — Laporan Dokter (V3-1). MK-1 laporan 90 hari tampil/cetak; MK-2
 * bagikan QR/link ber-TTL; MK-3 pilih rentang + bagian + ringkasan naratif; MK-4 subjek
 * anggota keluarga. On-device untuk pembuatan; berbagi via Edge Function. Non-diagnosis.
 * Flag NEXT_PUBLIC_FEATURE_CONSULTATION.
 */

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

const RANGES = [30, 90, 180];
const SECTION_LABEL: Record<ReportSection, string> = {
  biomarkers: "Biomarker", warnings: "Deteksi dini", medications: "Obat",
  lifestyle: "Gaya hidup", nutrition: "Gizi", documents: "Dokumen",
};
const ALL_ON: Record<ReportSection, boolean> = {
  biomarkers: true, warnings: true, medications: true, lifestyle: true, nutrition: true, documents: true,
};

export function ConsultationReportCard() {
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [days, setDays] = useState(90);
  const [full, setFull] = useState<ConsultationReport | null>(null);
  const [include, setInclude] = useState<Record<ReportSection, boolean>>({ ...ALL_ON });
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<{ id: string; displayName: string; isSelf: boolean }[]>([]);
  const [share, setShare] = useState<ShareLink | null>(null);
  const [qr, setQr] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!featureFamily()) return;
    void familyMembers().then((m) => setMembers(m.map((x) => ({ id: x.id, displayName: x.displayName, isSelf: x.isSelf }))));
  }, []);

  const view = full ? filterReport(full, include) : null;

  const generate = async () => {
    setLoading(true); setShare(null); setQr(""); setShareMsg("");
    try {
      setFull(await consultationReport({ days, profileId: subjectId }));
      setInclude({ ...ALL_ON });
    } finally { setLoading(false); }
  };

  const doShare = async () => {
    if (!view) return;
    setSharing(true); setShareMsg("");
    try {
      const res = await createShareLink(view, 45, subjectId);
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

  const reset = () => { setFull(null); setShare(null); setQr(""); setShareMsg(""); };

  return (
    <div style={card} className="ah-consult">
      <style>{`@media print{body *{visibility:hidden}.ah-consult,.ah-consult *{visibility:visible}.ah-consult{position:absolute;left:0;top:0;width:100%;border:none}.ah-noprint{display:none!important}}`}</style>

      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🩺 Mode Konsultasi</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Ringkasan untuk dibawa ke dokter. Dibuat di perangkatmu — bukan diagnosis.
        </p>
      </div>

      {!full && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} className="ah-noprint">
          {featureFamily() && members.length > 1 && (
            <div>
              <p style={miniLabel}>Untuk</p>
              <div style={chipRow}>
                {members.map((m) => {
                  const active = (subjectId ?? members.find((x) => x.isSelf)?.id) === m.id;
                  return (
                    <button key={m.id} onClick={() => setSubjectId(m.id)} aria-pressed={active} style={chip(active)}>
                      {m.isSelf ? "Saya" : m.displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <p style={miniLabel}>Rentang</p>
            <div style={chipRow}>
              {RANGES.map((d) => (
                <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} style={chip(days === d)}>{d} hari</button>
              ))}
            </div>
          </div>
          <button onClick={() => void generate()} disabled={loading} style={primaryBtn}>
            {loading ? "Menyiapkan…" : "Buat laporan konsultasi"}
          </button>
        </div>
      )}

      {view && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Pilih bagian (MK-3) */}
          {full!.sections.length > 0 && (
            <div className="ah-noprint">
              <p style={miniLabel}>Sertakan bagian</p>
              <div style={chipRow}>
                {full!.sections.map((s) => (
                  <button key={s} onClick={() => setInclude((v) => ({ ...v, [s]: !v[s] }))} aria-pressed={include[s]} style={chip(include[s])}>
                    {include[s] ? "✓ " : ""}{SECTION_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ringkasan naratif (MK-3) */}
          <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.5, fontStyle: "italic" }}>
            {narrativeSummary(view)}
          </p>

          <ConsultationReportView report={view} />

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
              <button onClick={() => void doShare()} disabled={sharing || view.isEmpty} style={primaryBtn}>
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
const miniLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--ah-text-tertiary)", marginBottom: 4 };
const chipRow: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const chip = (active: boolean): React.CSSProperties => ({
  minHeight: 34, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
  border: active ? "1.5px solid var(--ah-cyan, #22D3EE)" : "1px solid var(--ah-border)",
  background: active ? "rgba(34,211,238,0.14)" : "var(--ah-surface-2)",
  color: "var(--ah-text-primary)", fontSize: 12, fontWeight: 700,
});
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
