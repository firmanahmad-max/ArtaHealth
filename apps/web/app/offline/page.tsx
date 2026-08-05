"use client";

/**
 * Fallback navigasi saat offline DAN halaman belum pernah di-precache.
 * Nada: menenangkan + menegaskan data aman (CONTEXT §4, ui-ux §5).
 */
export default function OfflinePage() {
  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "80px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div style={{ fontSize: 40 }}>📶</div>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>Belum tersambung ke internet</h1>
      <p style={{ fontSize: 13, color: "var(--ah-text-secondary)" }}>
        Catatan Anda aman tersimpan di perangkat dan akan tersinkron otomatis begitu online.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ marginTop: 6, minHeight: 44, padding: "0 20px", borderRadius: "var(--ah-r-full)", border: "none", background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        Coba Lagi
      </button>
    </main>
  );
}
