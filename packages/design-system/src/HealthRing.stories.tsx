import type { Meta, StoryObj } from "@storybook/react";
import { HealthRing } from "./HealthRing";

const meta: Meta<typeof HealthRing> = {
  title: "Signature/HealthRing",
  component: HealthRing,
  argTypes: {
    score: { control: { type: "range", min: 0, max: 100, step: 1 } },
    size: { control: { type: "inline-radio" }, options: [48, 96, 168] },
    showLabel: { control: "boolean" },
  },
  args: { score: 89, size: 168, showLabel: true },
};
export default meta;
type Story = StoryObj<typeof HealthRing>;

export const Default: Story = {};

/** Empat band skor: excellent / good / fair / low (ui-ux-spec §1). */
export const Bands: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <HealthRing score={92} />
      <HealthRing score={76} />
      <HealthRing score={58} />
      <HealthRing score={34} />
    </div>
  ),
};

/** Ukuran: 48 (indikator Timeline/notifikasi), 96, 168 (hero). */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <HealthRing score={82} size={48} strokeWidth={5} showLabel={false} />
      <HealthRing score={82} size={96} strokeWidth={8} />
      <HealthRing score={82} size={168} />
    </div>
  ),
};
