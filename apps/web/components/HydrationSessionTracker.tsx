"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import { db, startOfTodayIso } from "@/lib/db";
import { prayerTimesFor } from "@/lib/fasting";
import { logHydration } from "@/lib/quicklog";
import { useMounted } from "@/lib/useMounted";

/**
 * HydrationTracker mode jendela (addendum-ramadan §6.2): gelas dikelompokkan tiga
 * sesi (Berbuka · Malam · Sahur) dengan pola anjuran 2-4-2. Saat jam puasa siang,
 * seluruh tracker diredupkan — "jendela hidrasi terbuka saat berbuka", bukan
 * menghukum user karena tak minum saat berpuasa (microcopy §6.8).
 */

const SESSIONS: { label: string; glasses: number }[] = [
  { label: "Berbuka", glasses: 2 },
  { label: "Malam", glasses: 4 },
  { label: "Sahur", glasses: 2 },
];
const TOTAL_GLASSES = SESSIONS.reduce((s, x) => s + x.glasses, 0); // 8

const nowMinutes = (): number => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export function HydrationSessionTracker() {
  const { show } = useToast();
  const mounted = useMounted();
  const today = startOfTodayIso();
  const logs = useLiveQuery(
    () => db.hydration_logs.where("loggedAt").aboveOrEqual(today).filter((l) => !l.deletedAt).toArray(),
    [today],
  );
  const target = useLiveQuery(async () => Number((await db.meta.get("targetHydrationMl"))?.value) || 2500, []);
  const times = useLiveQuery(() => prayerTimesFor(), []);
  const [now, setNow] = useState(-1);
  useEffect(() => {
    setNow(nowMinutes());
    const id = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!logs || !target || !times) return null;

  const glassMl = Math.round(target / TOTAL_GLASSES / 50) * 50; // dibulatkan ke 50 ml
  const intakeMl = logs.reduce((s, l) => s + l.volumeMl, 0);
  const filled = Math.min(TOTAL_GLASSES, Math.floor(intakeMl / glassMl));

  // jam puasa siang (imsak ≤ now < maghrib) → jendela hidrasi belum dibuka
  const daytimeFasting = mounted && now >= 0 && now >= times.imsak && now < times.maghrib;

  const addGlass = async () => {
    try {
      await logHydration(glassMl);
    } catch { show({ variant: "error", message: "Gagal mencatat. Coba lagi." }); }
  };

  let idx = 0;
  return (
    <div style={{ ...card, opacity: daytimeFasting ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" }}>💧 Hidrasi Puasa</p>
        <span style={{ fontSize: 11, color: "var(--ah-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
          {(intakeMl / 1000).toFixed(1).replace(".", ",")} / {(target / 1000).toFixed(1).replace(".", ",")} L
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {SESSIONS.map((sesi) => (
          <div key={sesi.label} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: sesi.glasses }).map(() => {
                const myIdx = idx++;
                const isFilled = myIdx < filled;
                return (
                  <button
                    key={myIdx}
                    onClick={() => void addGlass()}
                    disabled={daytimeFasting}
                    aria-label={isFilled ? "Gelas terisi" : "Tambah satu gelas"}
                    style={{
                      width: 22, height: 30, borderRadius: "0 0 8px 8px", cursor: daytimeFasting ? "default" : "pointer",
                      border: "2px solid var(--ah-hydration, #38BDF8)",
                      background: isFilled ? "var(--ah-hydration, #38BDF8)" : "transparent",
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>
            <span style={{ fontSize: 10, color: "var(--ah-text-tertiary)" }}>{sesi.label}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: "var(--ah-text-tertiary)", lineHeight: 1.5 }}>
        {daytimeFasting
          ? "Jendela hidrasi terbuka saat berbuka — targetnya tetap tercapai kok, asal dicicil 🌙"
          : `Pola anjuran 2-4-2 · ${glassMl} ml per gelas. Ketuk gelas untuk mencatat.`}
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14, display: "flex", flexDirection: "column", gap: 12,
};
