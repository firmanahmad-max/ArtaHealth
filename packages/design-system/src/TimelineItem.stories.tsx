import type { Meta, StoryObj } from "@storybook/react";
import { TimelineItem } from "./TimelineItem";

const meta: Meta<typeof TimelineItem> = {
  title: "Timeline/TimelineItem",
  component: TimelineItem,
  args: {
    time: "07:30",
    icon: "💧",
    domainCssVar: "var(--ah-hydration)",
    title: "Minum 250 ml",
    detail: "Air putih",
  },
};
export default meta;
type Story = StoryObj<typeof TimelineItem>;

export const Default: Story = {};

/** Menunggu sinkron: opacity 0.75 + ikon ↻. */
export const PendingSync: Story = { args: { pendingSync: true } };

/** Beberapa item, warna node per domain — terbaca sekilas tanpa membaca teks. */
export const Feed: Story = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <TimelineItem time="21:40" icon="🌙" domainCssVar="var(--ah-sleep)" title="Tidur 7j 0m" detail="22:30–05:30" />
      <TimelineItem time="18:05" icon="👟" domainCssVar="var(--ah-activity)" title="Jalan" detail="30 mnt · 3.200 langkah" />
      <TimelineItem time="12:15" icon="🙂" domainCssVar="var(--ah-mood)" title="Mood 4/5" />
      <TimelineItem time="07:30" icon="💧" domainCssVar="var(--ah-hydration)" title="Minum 250 ml" detail="Air putih" pendingSync isLast />
    </div>
  ),
};
