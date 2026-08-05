import type { Meta, StoryObj } from "@storybook/react";
import { StatusChip } from "./StatusChip";

const meta: Meta<typeof StatusChip> = {
  title: "Kartu/StatusChip",
  component: StatusChip,
  args: { label: "Baik", cssVar: "var(--ah-score-good)" },
};
export default meta;
type Story = StoryObj<typeof StatusChip>;

export const Default: Story = {};

/** Warna mengikuti band skor; status tidak pernah hanya warna → selalu ada label. */
export const Bands: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <StatusChip label="Sangat Baik" cssVar="var(--ah-score-excellent)" />
      <StatusChip label="Baik" cssVar="var(--ah-score-good)" />
      <StatusChip label="Cukup" cssVar="var(--ah-score-fair)" />
      <StatusChip label="Perlu Perhatian" cssVar="var(--ah-score-low)" />
    </div>
  ),
};
