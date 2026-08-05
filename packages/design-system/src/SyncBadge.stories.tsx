import type { Meta, StoryObj } from "@storybook/react";
import { SyncBadge } from "./SyncBadge";

const meta: Meta<typeof SyncBadge> = {
  title: "Status/SyncBadge",
  component: SyncBadge,
  args: { pending: 0, online: true },
};
export default meta;
type Story = StoryObj<typeof SyncBadge>;

/** Tiga status; teks selalu menyertai warna (status tak pernah hanya warna). */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <SyncBadge pending={0} online={true} />
      <SyncBadge pending={3} online={true} />
      <SyncBadge pending={5} online={false} />
    </div>
  ),
};

export const Synced: Story = {};
export const Pending: Story = { args: { pending: 3 } };
export const Offline: Story = { args: { online: false, pending: 2 } };
