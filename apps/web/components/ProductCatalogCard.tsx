"use client";
import { useEffect, useState } from "react";
import type { NutritionZone } from "@arta/core";
import { searchLocalCatalog, type CatalogHit } from "@/lib/product-catalog";
import { useMounted } from "@/lib/useMounted";

/**
 * Katalog Produk Komunal (backlog · KC-1) — cari produk yang pernah kamu simpan & pakai ulang
 * gizinya tanpa scan ulang; verdict dihitung personal (kondisimu). Berbagi komunal (baca/tulis
 * termoderasi) menyusul (KC-2, gerbang moderasi). Flag NEXT_PUBLIC_FEATURE_CATALOG.
 */

const ZONE_COLOR: Record<NutritionZone, string> = {
  green: "var(--ah-score-excellent)", yellow: "var(--ah-score-fair)", red: "var(--ah-score-low)",
};
const ZONE_EMOJI: Record<NutritionZone, string> = { green: "🟢", yellow: "🟡", red: "🔴" };

export function ProductCatalogCard() {
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    void searchLocalCatalog(query).then(setHits);
  }, [mounted, query]);
  useEffect(() => {
    if (!mounted) return;
    void searchLocalCatalog("").then((all) => setTotal(all.length));
  }, [mounted]);

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>📖 Katalog Produk</p>
        <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", marginTop: 2 }}>
          Cari produk yang pernah kamu pindai — pakai ulang tanpa scan lagi. {total} produk tersimpan.
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari nama produk…"
        style={search}
        aria-label="Cari produk"
      />

      {total === 0 ? (
        <div style={emptyBox}>
          <p style={{ fontSize: 11.5, color: "var(--ah-text-secondary)", lineHeight: 1.5 }}>
            Belum ada produk tersimpan. Pindai label lewat Sadar Gizi lalu simpan ke lemari — produk akan muncul di sini.
          </p>
        </div>
      ) : hits.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>Tidak ada produk cocok "{query}".</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {hits.map((h) => (
            <div key={h.entry.key} style={{ ...row, borderLeft: `4px solid ${ZONE_COLOR[h.verdict.overall]}` }}>
              <span style={{ fontSize: 18 }}>{ZONE_EMOJI[h.verdict.overall]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ah-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.entry.displayName}
                </p>
                <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", marginTop: 1 }}>
                  {h.entry.foodForm === "beverage" ? "Minuman" : "Padat"} · {h.verdict.headline}
                  {h.entry.contributions > 1 && ` · ${h.entry.contributions} entri`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        Katalog pribadi dari pindaianmu; penilaian disesuaikan kondisimu, bukan diagnosis. Berbagi katalog antar-pengguna (komunal) menyusul.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
const search: React.CSSProperties = {
  minHeight: 40, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", padding: "0 12px", fontSize: 13,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
  borderRadius: "var(--ah-r-inner)", background: "var(--ah-surface-2)", border: "1px solid var(--ah-border)",
};
const emptyBox: React.CSSProperties = {
  borderRadius: "var(--ah-r-inner)", padding: "10px 12px",
  background: "var(--ah-surface-2)", border: "1px dashed var(--ah-border)",
};
