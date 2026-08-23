"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ConsultationReport } from "@arta/core";
import { fetchSharedReport } from "@/lib/consultation-share";
import { ConsultationReportView } from "@/components/ConsultationReportView";

/**
 * Halaman PUBLIK read-only laporan konsultasi (V3-1 · MK-2). Dibuka dokter via link/QR
 * `/r/<token>`. Tanpa login: ambil snapshot terenkripsi via Edge Function consultation-view
 * (token acak = kapabilitas). Hormati kedaluwarsa/cabut. Hanya menampilkan — tak bisa diubah.
 */

type State =
  | { phase: "loading" }
  | { phase: "ok"; report: ConsultationReport; expiresAt: string }
  | { phase: "error"; message: string };

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    if (!token) { setState({ phase: "error", message: "Link tidak valid." }); return; }
    let alive = true;
    void fetchSharedReport(token).then((res) => {
      if (!alive) return;
      if (res.ok) setState({ phase: "ok", report: res.report, expiresAt: res.expiresAt });
      else setState({ phase: "error", message: res.message });
    });
    return () => { alive = false; };
  }, [token]);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>Laporan dibagikan via ArtaHealth</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>Tampilan read-only untuk tenaga kesehatan.</p>
      </header>

      {state.phase === "loading" && (
        <p style={{ fontSize: 13, color: "var(--ah-text-secondary)" }}>Memuat laporan…</p>
      )}

      {state.phase === "error" && (
        <div style={box}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ah-text-primary)" }}>Tak bisa membuka laporan</p>
          <p style={{ fontSize: 12, color: "var(--ah-text-secondary)", marginTop: 4 }}>{state.message}</p>
          <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 8 }}>
            Minta pemilik membuat link baru bila diperlukan.
          </p>
        </div>
      )}

      {state.phase === "ok" && (
        <div style={box}>
          <ConsultationReportView report={state.report} />
        </div>
      )}
    </main>
  );
}

const box: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 16,
};
