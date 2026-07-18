"use client";
import { useEffect, useRef, useState } from "react";

export interface SheetModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Bottom sheet dengan drag handle, snap 50/90% (ui-ux-spec §2).
 * Drag handle ke atas → snap 90%; ke bawah → snap 50%; lanjut ke bawah → tutup.
 */
export function SheetModal({ open, onClose, title, children }: SheetModalProps) {
  const [tall, setTall] = useState(false);
  const drag = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });

  useEffect(() => {
    if (!open) return;
    setTall(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, active: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dy = e.clientY - drag.current.startY;
    if (dy < -40) setTall(true);
    else if (dy > 40) { if (tall) setTall(false); else onClose(); }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(4,7,16,.55)", backdropFilter: "blur(2px)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          maxWidth: 480, margin: "0 auto",
          height: tall ? "90dvh" : "50dvh",
          background: "var(--ah-surface-1)",
          borderRadius: "var(--ah-r-card) var(--ah-r-card) 0 0",
          border: "1px solid var(--ah-border)", borderBottom: "none",
          display: "flex", flexDirection: "column",
          transition: "height var(--ah-dur-med) var(--ah-ease-out)",
          animation: "ah-sheet-in var(--ah-dur-med) var(--ah-ease-out)",
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          style={{ padding: "10px 0 6px", cursor: "grab", touchAction: "none", flexShrink: 0 }}
          aria-hidden
        >
          <div style={{ width: 40, height: 4, borderRadius: "var(--ah-r-full)", background: "var(--ah-text-tertiary)", opacity: 0.5, margin: "0 auto" }} />
        </div>
        {title && (
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ah-text-primary)", padding: "2px 20px 10px", flexShrink: 0 }}>
            {title}
          </h2>
        )}
        <div style={{ overflowY: "auto", padding: "0 20px calc(20px + env(safe-area-inset-bottom, 0px))", flex: 1 }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes ah-sheet-in { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </div>
  );
}
