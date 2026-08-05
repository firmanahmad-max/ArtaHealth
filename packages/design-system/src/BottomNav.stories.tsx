import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { BottomNav } from "./BottomNav";

const ITEMS = [
  { key: "home", label: "Beranda", icon: "🏠" },
  { key: "timeline", label: "Timeline", icon: "📈" },
  { key: "log", label: "Catat", icon: "＋", fab: true },
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "profile", label: "Profil", icon: "👤" },
];

const meta: Meta<typeof BottomNav> = {
  title: "Navigasi/BottomNav",
  component: BottomNav,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof BottomNav>;

/** 5 tab; tab aktif diberi dot gradient; tab tengah "Catat" = FAB. */
export const Interactive: Story = {
  render: () => {
    const [active, setActive] = useState("home");
    return (
      <div style={{ position: "relative", height: 160 }}>
        <p style={{ fontSize: 13, color: "var(--ah-text-secondary)", padding: 8 }}>
          Aktif: <strong>{active}</strong> — klik tab untuk berpindah.
        </p>
        <BottomNav items={ITEMS} activeKey={active} onSelect={setActive} />
      </div>
    );
  },
};
