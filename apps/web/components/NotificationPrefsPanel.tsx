"use client";
import { useEffect, useState } from "react";
import { useToast } from "@arta/design-system";
import { NOTIFICATION_CATEGORIES, toggleMuted, type NotificationCategory } from "@arta/core";
import { loadMuted, saveMuted } from "@/lib/notification-prefs";
import { featureRamadan } from "@/lib/features";

/**
 * Daftar jenis pengingat yang bisa dinyalakan/dimatikan satu per satu (di dalam PushToggle saat
 * pengingat aktif). Membisukan satu jenis TIDAK mencabut izin notifikasi — jenis lain tetap jalan.
 * Kategori musiman (sahur & berbuka) hanya tampil bila Mode Ramadan aktif.
 */
export function NotificationPrefsPanel() {
  const { show } = useToast();
  const [muted, setMuted] = useState<NotificationCategory[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadMuted().then((m) => { if (alive) setMuted(m); }).catch(() => { if (alive) setMuted([]); });
    return () => { alive = false; };
  }, []);

  if (muted === null) return <p style={note}>Memuat…</p>;

  const categories = NOTIFICATION_CATEGORIES.filter((c) => !c.seasonal || featureRamadan());
  const allMuted = categories.every((c) => muted.includes(c.id));

  /** `on` = status SAAT INI; klik pada jenis yang menyala → bisukan, dan sebaliknya. */
  const toggle = async (id: NotificationCategory, on: boolean) => {
    const prev = muted;
    const next = toggleMuted(muted, id, on);
    setMuted(next);
    setBusy(true);
    try {
      const synced = await saveMuted(next);
      if (!synced) show({ variant: "info", message: "Tersimpan di perangkat ini — dikirim saat tersambung." });
    } catch {
      setMuted(prev);
      show({ variant: "error", message: "Gagal menyimpan. Coba lagi sebentar." });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
      {categories.map((c) => {
        const on = !muted.includes(c.id);
        return (
          <label key={c.id} style={itemRow}>
            <span style={{ flex: 1 }}>
              <span style={itemLabel}>{c.label}</span>
              <span style={itemHint}>{c.hint}</span>
            </span>
            <button
              type="button" role="switch" aria-checked={on} aria-label={c.label}
              disabled={busy} onClick={() => void toggle(c.id, on)}
              style={{ ...track, background: on ? "var(--ah-purple)" : "var(--ah-border)" }}
            >
              <span style={{ ...thumb, transform: on ? "translateX(18px)" : "translateX(0)" }} />
            </button>
          </label>
        );
      })}
      {allMuted && (
        <p style={note}>Semua jenis dimatikan — tak ada pengingat yang dikirim. Gunakan &quot;Matikan&quot; di atas
          bila ingin mencabut langganan di perangkat ini.</p>
      )}
    </div>
  );
}

const itemRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "4px 0",
  borderTop: "1px solid var(--ah-border)", cursor: "pointer",
};
const itemLabel: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ah-text-primary)" };
const itemHint: React.CSSProperties = { display: "block", fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.4 };
const note: React.CSSProperties = { fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.4, marginTop: 6 };
const track: React.CSSProperties = {
  position: "relative", width: 42, height: 24, flexShrink: 0, borderRadius: "var(--ah-r-full)",
  border: "none", padding: 3, cursor: "pointer", transition: "background 0.15s",
};
const thumb: React.CSSProperties = {
  display: "block", width: 18, height: 18, borderRadius: "50%", background: "#fff",
  transition: "transform 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
};
