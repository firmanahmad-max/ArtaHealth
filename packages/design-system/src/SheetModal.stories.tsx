import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { SheetModal } from "./SheetModal";

const meta: Meta<typeof SheetModal> = {
  title: "Overlay/SheetModal",
  component: SheetModal,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SheetModal>;

/** Bottom sheet: drag handle ke atas → 90%, ke bawah → 50% → tutup. Esc/backdrop menutup. */
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ minHeight: 300, padding: 16 }}>
        <button
          onClick={() => setOpen(true)}
          style={{ minHeight: 48, padding: "0 20px", borderRadius: "var(--ah-r-full)", border: "none", background: "var(--ah-gradient-hero)", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          Buka Sheet
        </button>
        <SheetModal open={open} onClose={() => setOpen(false)} title="Catat">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--ah-text-secondary)" }}>
              Seret pegangan di atas untuk memperbesar (90%) atau menutup.
            </p>
            {[150, 250, 600].map((ml) => (
              <div key={ml} style={{ padding: "14px 16px", borderRadius: "var(--ah-r-inner)", background: "var(--ah-surface-2)", color: "var(--ah-text-primary)", fontSize: 14, fontWeight: 700 }}>
                💧 {ml} ml
              </div>
            ))}
          </div>
        </SheetModal>
      </div>
    );
  },
};
