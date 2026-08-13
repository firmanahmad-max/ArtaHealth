"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@arta/design-system";
import { isFastingToday, setTodayFasting } from "@/lib/fasting";

/**
 * Toggle status puasa hari ini (addendum-ramadan §3.1/§6.4): switch DIAM —
 * tanpa dialog, tanpa menanyakan alasan (uzur = privasi, §2 aturan 2). Memilih
 * "tidak puasa" mengembalikan seluruh engine ke mode normal untuk hari itu.
 */
export function FastingToggle() {
  const { show } = useToast();
  const fasting = useLiveQuery(() => isFastingToday(), []) ?? false;

  const toggle = async () => {
    await setTodayFasting(fasting ? "not_fasting" : "fasting");
    show({ message: fasting ? "Ditandai tidak puasa hari ini" : "Puasa hari ini ✓" });
  };

  return (
    <button
      onClick={() => void toggle()}
      aria-pressed={fasting}
      style={{
        minHeight: 32, padding: "0 12px", borderRadius: "var(--ah-r-full)", cursor: "pointer",
        whiteSpace: "nowrap",
        border: fasting ? "1.5px solid var(--ah-purple)" : "1px solid var(--ah-border)",
        background: fasting ? "var(--ah-gradient-soft)" : "transparent",
        color: fasting ? "var(--ah-text-primary)" : "var(--ah-text-secondary)",
        fontSize: 12, fontWeight: 600,
      }}
    >
      {fasting ? "🌙 Puasa ✓" : "🌙 Tandai puasa"}
    </button>
  );
}
