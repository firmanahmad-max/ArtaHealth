"use client";
import { useEffect, useState } from "react";
import { useToast } from "@arta/design-system";
import { enablePush, disablePush, pushStatus, type PushStatus } from "@/lib/push";

/**
 * Pengaktifan pengingat — selalu lewat aksi eksplisit user, dengan alasan
 * yang disebutkan lebih dulu (ui-ux-spec §3.8: "untuk pengingat minum & tidur").
 * Kartu disembunyikan bila browser tidak mendukung atau push belum dikonfigurasi.
 */
export function PushToggle() {
  const { show } = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setStatus(pushStatus()); }, []);

  if (status === null || status === "unsupported" || status === "unconfigured") return null;

  const enable = async () => {
    setBusy(true);
    try {
      const next = await enablePush();
      setStatus(next);
      if (next === "granted") show({ message: "Pengingat diaktifkan" });
      else if (next === "denied") {
        show({ variant: "info", message: "Izin notifikasi ditolak. Anda bisa mengubahnya di pengaturan browser." });
      }
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disablePush();
      setStatus("default");
      show({ message: "Pengingat dimatikan" });
    } finally { setBusy(false); }
  };

  if (status === "granted") {
    return (
      <div style={row}>
        <div style={{ flex: 1 }}>
          <p style={title}>Pengingat aktif 🔔</p>
          <p style={desc}>Hanya dikirim bila ada yang personal untuk disampaikan.</p>
        </div>
        <button onClick={() => void disable()} disabled={busy} style={ghostBtn}>Matikan</button>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div style={row}>
        <div style={{ flex: 1 }}>
          <p style={title}>Pengingat dinonaktifkan</p>
          <p style={desc}>Izin notifikasi diblokir browser. Aktifkan lewat pengaturan situs bila ingin memakainya.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={row}>
      <div style={{ flex: 1 }}>
        <p style={title}>Ingatkan saya</p>
        <p style={desc}>Pengingat minum & tidur berdasarkan catatan Anda — bukan notifikasi asal.</p>
      </div>
      <button onClick={() => void enable()} disabled={busy} style={primaryBtn}>Aktifkan</button>
    </div>
  );
}

const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)",
  borderRadius: "var(--ah-r-card)", padding: 14,
};
const title: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--ah-text-primary)" };
const desc: React.CSSProperties = { fontSize: 11, color: "var(--ah-text-secondary)", lineHeight: 1.4 };
const primaryBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: "var(--ah-r-full)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  minHeight: 44, padding: "0 14px", borderRadius: "var(--ah-r-full)",
  border: "1px solid var(--ah-border)", background: "transparent",
  color: "var(--ah-text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
