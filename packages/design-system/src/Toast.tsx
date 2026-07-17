"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Toast bawah, di atas BottomNav (ui-ux-spec §2).
 * Sukses = ✓ hijau; log yang bisa di-undo memakai tombol "Urungkan" 5 detik —
 * pengganti dialog konfirmasi (CONTEXT §4: desain memaafkan).
 */

export interface ToastOptions {
  message: string;
  variant?: "success" | "error" | "info";
  /** dipanggil jika user menekan "Urungkan" sebelum toast hilang */
  onUndo?: () => void;
  durationMs?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

const ToastContext = createContext<{ show: (opts: ToastOptions) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider>");
  return ctx;
}

const VARIANT_ICON = { success: "✓", error: "!", info: "•" } as const;
const VARIANT_VAR = {
  success: "var(--ah-score-excellent)",
  error: "var(--ah-score-low)",
  info: "var(--ah-cyan)",
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((opts: ToastOptions) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setToast({ variant: "success", durationMs: 5000, ...opts, id });
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), opts.durationMs ?? 5000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const dismiss = () => {
    clearTimeout(timer.current);
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", left: 16, right: 16, zIndex: 50,
            bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
            maxWidth: 420, margin: "0 auto",
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--ah-surface-2)", border: "1px solid var(--ah-border)",
            borderRadius: "var(--ah-r-inner)", padding: "12px 14px",
            boxShadow: "0 8px 28px rgba(0,0,0,.35)",
            animation: "ah-toast-in var(--ah-dur-med) var(--ah-ease-out)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 22, height: 22, flexShrink: 0, borderRadius: "var(--ah-r-full)",
              background: VARIANT_VAR[toast.variant ?? "success"], color: "#0A0E1A",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800,
            }}
          >
            {VARIANT_ICON[toast.variant ?? "success"]}
          </span>
          <span style={{ flex: 1, fontSize: 13, color: "var(--ah-text-primary)" }}>{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={() => { toast.onUndo?.(); dismiss(); }}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--ah-cyan)", fontSize: 13, fontWeight: 700,
                minHeight: 44, padding: "0 6px",
              }}
            >
              Urungkan
            </button>
          )}
        </div>
      )}
      <style>{`@keyframes ah-toast-in { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
}
