import type { Meta, StoryObj } from "@storybook/react";
import { SkeletonCard } from "./SkeletonCard";

const meta: Meta<typeof SkeletonCard> = {
  title: "Kartu/SkeletonCard",
  component: SkeletonCard,
  args: { height: 96 },
  argTypes: { height: { control: { type: "range", min: 48, max: 240, step: 4 } } },
};
export default meta;
type Story = StoryObj<typeof SkeletonCard>;

/** State loading — shimmer gradient gelap. Hormati prefers-reduced-motion di runtime. */
export const Default: Story = {};

export const Stack: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
      <SkeletonCard height={132} />
      <SkeletonCard height={72} />
      <SkeletonCard height={72} />
    </div>
  ),
};
