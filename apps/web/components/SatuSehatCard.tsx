"use client";
import { useEffect, useState } from "react";
import { bundleSummary, downloadFhirBundle } from "@/lib/satusehat";
import { useMounted } from "@/lib/useMounted";

/**
 * SATUSEHAT / FHIR (backlog · SS-1) — ekspor data ke berkas FHIR R4 standar (dibawa ke faskes /
 * diarsipkan). OFFLINE: berkas dibuat di perangkat, tanpa unggah. Sinkronisasi langsung ke
 * SATUSEHAT butuh registrasi organisasi Kemenkes (SS-2) → belum tersedia. Flag NEXT_PUBLIC_FEATURE_SATUSEHAT.
 */

const RESOURCE_LABEL: Record<string, string> = {
  Patient: "Identitas", Observation: "Hasil ukur", MedicationStatement: "Obat",
};

export function SatuSehatCard() {
  const mounted = useMounted();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    void bundleSummary().then(({ counts, total }) => { setCounts(counts); setTotal(total); });
  }, [mounted]);

  const onExport = async () => {
    setBusy(true);
    try { await downloadFhirBundle(); } finally { setBusy(false); }
  };

  const hasData = total > 0;

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>🔗 SATUSEHAT — Ekspor FHIR</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Kemas datamu ke berkas standar FHIR R4 (LOINC) untuk dibawa ke faskes atau diarsipkan.
        </p>
      </div>

      {counts && hasData ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(counts).map(([type, n]) => (
            <div key={type} style={chip}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>{n}</span>
              <span style={{ fontSize: 10.5, color: "var(--ah-text-tertiary)" }}>{RESOURCE_LABEL[type] ?? type}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={emptyBox}>
          <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
            Belum ada data untuk diekspor. Catat pengukuran/obat atau impor data perangkat (Wearable) dulu.
          </p>
        </div>
      )}

      <button onClick={onExport} disabled={!hasData || busy} style={{ ...primaryBtn, opacity: !hasData || busy ? 0.55 : 1 }}>
        {busy ? "Menyiapkan…" : `⬇️ Unduh berkas FHIR (.json)${hasData ? ` · ${total} resource` : ""}`}
      </button>

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Berkas dibuat di perangkatmu — tidak diunggah. Sinkronisasi langsung ke SATUSEHAT memerlukan
        registrasi organisasi Kemenkes (menyusul). Ekspor ini berisi nilai apa adanya, bukan diagnosis.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const chip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
  borderRadius: "var(--ah-r-full)", background: "var(--ah-surface-2)", border: "1px solid var(--ah-border)",
};
const emptyBox: React.CSSProperties = {
  borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
  background: "var(--ah-surface-2)", border: "1px dashed var(--ah-border)",
};
const primaryBtn: React.CSSProperties = {
  minHeight: 40, borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer",
  background: "var(--ah-accent)", color: "#fff", fontSize: 12.5, fontWeight: 700,
};
