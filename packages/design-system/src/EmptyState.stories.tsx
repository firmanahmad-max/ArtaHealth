import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Feedback/EmptyState",
  component: EmptyState,
  args: {
    icon: "🤖",
    title: "Belum ada catatan hari ini",
    description: "Mulai dari satu yang kecil — konsistensi mengalahkan intensitas.",
    ctaLabel: "+ Catat sesuatu",
  },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = { args: { onCta: () => {} } };

/** Tanpa CTA — hanya ilustrasi + copy. */
export const TanpaCta: Story = {
  args: { icon: "🗒️", title: "Belum ada apa pun di sini", description: undefined, ctaLabel: undefined },
};
