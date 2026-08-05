import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider, useToast } from "./Toast";

const meta: Meta = {
  title: "Feedback/Toast",
  decorators: [(Story) => <ToastProvider><Story /></ToastProvider>],
};
export default meta;
type Story = StoryObj;

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ minHeight: 44, padding: "0 16px", borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)", background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      {label}
    </button>
  );
}

/** Toast muncul di atas nav. Sukses = ✓ hijau; log memakai tombol Urungkan 5 detik. */
export const Playground: Story = {
  render: () => {
    const Demo = () => {
      const { show } = useToast();
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
          <Btn label="Sukses + Urungkan" onClick={() => show({ message: "Air 250 ml tercatat", onUndo: () => {} })} />
          <Btn label="Info" onClick={() => show({ variant: "info", message: "Kode 6 digit terkirim" })} />
          <Btn label="Error" onClick={() => show({ variant: "error", message: "Gagal mencatat. Coba lagi." })} />
        </div>
      );
    };
    return <Demo />;
  },
};
