"use client";
import { useRouter } from "next/navigation";
import { BottomNav } from "@arta/design-system";

const ITEMS = [
  { key: "home", label: "Beranda", icon: "🏠", href: "/" },
  { key: "timeline", label: "Timeline", icon: "📈", href: "/timeline" },
  { key: "log", label: "Catat", icon: "＋", fab: true },
  { key: "chat", label: "Chat", icon: "💬", href: "/chat" },
  { key: "fitur", label: "Fitur", icon: "🧭", href: "/fitur" },
];

/** BottomNav ter-wiring router; FAB "Catat" diserahkan ke halaman via onLog. */
export function AppNav({ activeKey, onLog }: { activeKey: string; onLog: () => void }) {
  const router = useRouter();
  return (
    <BottomNav
      activeKey={activeKey}
      items={ITEMS}
      onSelect={(key) => {
        if (key === "log") { onLog(); return; }
        const item = ITEMS.find((i) => i.key === key);
        if (item?.href && key !== activeKey) router.push(item.href);
      }}
    />
  );
}
