"use client";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

/**
 * Batas error global App Router — menggantikan root layout saat render gagal,
 * jadi ia membawa <html>/<body> sendiri. Melaporkan ke Sentry (inert bila DSN
 * kosong) lalu menampilkan pesan yang menenangkan (CONTEXT §4: error memberi arah).
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="id" data-theme="dark">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "var(--ah-bg)" }}>
        <main style={{ maxWidth: 400, margin: "0 auto", padding: "80px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 40 }}>🩹</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ah-text-primary)" }}>Ada yang tidak beres sesaat</h1>
          <p style={{ fontSize: 13, color: "var(--ah-text-secondary)" }}>
            Catatan Anda tetap aman tersimpan. Coba muat ulang halaman.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 6, minHeight: 44, padding: "0 20px", borderRadius: "var(--ah-r-full)", border: "none", background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Muat Ulang
          </button>
        </main>
      </body>
    </html>
  );
}
