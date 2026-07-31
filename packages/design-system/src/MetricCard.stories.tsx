import type { Meta, StoryObj } from "@storybook/react";
import { MetricCard } from "./MetricCard";

const meta: Meta<typeof MetricCard> = {
  title: "Kartu/MetricCard",
  component: MetricCard,
  args: { icon: "💧", name: "Hidrasi", value: "2,1 L", chip: "84%", chipCssVar: "var(--ah-score-fair)" },
};
export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Default: Story = {};

/** State kosong: value null → tombol "+ Catat" (ui-ux-spec §2.2). */
export const Empty: Story = {
  args: { value: null },
};

/** Menunggu sinkron: ikon ↻ di pojok. */
export const PendingSync: Story = {
  args: { pendingSync: true },
};

/** Grid 4 kolom seperti di Beranda — campuran state. */
export const GridStates: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxWidth: 360 }}>
      <MetricCard icon="🌙" name="Tidur" value="7j 45m" chip="Baik" chipCssVar="var(--ah-score-excellent)" />
      <MetricCard icon="👟" name="Aktivitas" value="8.456" unit="lkh" chip="106%" chipCssVar="var(--ah-score-good)" />
      <MetricCard icon="💧" name="Hidrasi" value="2,1 L" chip="84%" chipCssVar="var(--ah-score-fair)" pendingSync />
      <MetricCard icon="🔥" name="Kalori" value={null} />
    </div>
  ),
};
