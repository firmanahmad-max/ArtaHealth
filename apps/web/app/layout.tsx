import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@arta/design-system";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ArtaHealth — AI Personal Health Companion",
  description: "Teman kesehatan pribadi yang memahami kebiasaan Anda, bukan sekadar mencatat data.",
};
export const viewport: Viewport = {
  themeColor: "#0A0E1A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme="dark" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
