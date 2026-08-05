import type { Meta, StoryObj } from "@storybook/react";
import { StreakFlame } from "./StreakFlame";

const meta: Meta<typeof StreakFlame> = {
  title: "Status/StreakFlame",
  component: StreakFlame,
  args: { streak: 7 },
  argTypes: { streak: { control: { type: "number", min: 0 } } },
};
export default meta;
type Story = StoryObj<typeof StreakFlame>;

export const Active: Story = {};

/** Streak 0 = api abu (grayscale), belum menyala. */
export const Zero: Story = { args: { streak: 0 } };

export const Milestones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <StreakFlame streak={0} />
      <StreakFlame streak={1} />
      <StreakFlame streak={7} />
      <StreakFlame streak={30} />
      <StreakFlame streak={100} />
    </div>
  ),
};
